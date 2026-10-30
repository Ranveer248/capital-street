-- Capital Street multiplayer (Goals 11 and 15): players, who owns which building, chat, cloud saves and trading between players.
-- Run once in a Supabase project (SQL editor, or as a migration). Everything is prefixed cs_ so it can share a project.
-- Everyone can read everything; every write is checked here, on the server:
--   a player row is yours alone, a building can only be claimed if nobody else owns it, chat is posted as yourself.
-- Not yet checked here: what you paid. Cash still lives in each player's own save until the economy moves to the
-- server (Goals 14 and 15), so a player who edits their save could afford more than they should.

-- ---------- players ----------
create table if not exists public.cs_players (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (name ~ '^[A-Za-z0-9][A-Za-z0-9 _.-]{1,18}[A-Za-z0-9]$'),
  color text not null default '#4c8dff' check (color ~ '^#[0-9a-fA-F]{6}$'),
  city text not null default 'nyc' check (city in ('nyc', 'london', 'tokyo', 'hongkong', 'dubai')),
  net_worth numeric not null default 0 check (net_worth between -1e12 and 1e15), -- reported by the player's game
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create unique index if not exists cs_players_name on public.cs_players (lower(name));
alter table public.cs_players enable row level security;
drop policy if exists "players are public" on public.cs_players;
create policy "players are public" on public.cs_players for select using (true);
drop policy if exists "you create your own player" on public.cs_players;
create policy "you create your own player" on public.cs_players for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "you edit your own player" on public.cs_players;
create policy "you edit your own player" on public.cs_players for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- ---------- buildings: one owner per building, in every city ----------
create table if not exists public.cs_buildings (
  city text not null check (city in ('nyc', 'london', 'tokyo', 'hongkong', 'dubai')),
  building text not null check (char_length(building) between 1 and 40), -- the game's property key, e.g. '1234' or 'london:18'
  owner uuid not null references public.cs_players (id) on delete cascade,
  floors int not null check (floors between 1 and 300),
  name text check (char_length(name) <= 80),
  bought_at timestamptz not null default now(),
  primary key (city, building)
);
create index if not exists cs_buildings_owner on public.cs_buildings (owner);
alter table public.cs_buildings enable row level security;
alter table public.cs_buildings replica identity full; -- so live updates say whose building was sold
drop policy if exists "ownership is public" on public.cs_buildings;
create policy "ownership is public" on public.cs_buildings for select using (true);
-- no insert, update or delete policies: changes only through the two functions below

create or replace function public.cs_claim_building(p_city text, p_building text, p_floors int, p_name text)
returns public.cs_buildings language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  r public.cs_buildings;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from public.cs_players where id = me) then raise exception 'Pick a player name first'; end if;
  insert into public.cs_buildings as b (city, building, owner, floors, name)
    values (p_city, p_building, me, p_floors, left(p_name, 80))
  on conflict (city, building) do update set floors = excluded.floors, name = excluded.name where b.owner = me
  returning * into r;
  if r.owner is null then raise exception 'Another player owns this building'; end if;
  return r;
end $$;

create or replace function public.cs_release_building(p_city text, p_building text)
returns void language sql security definer set search_path = '' as $$
  delete from public.cs_buildings where city = p_city and building = p_building and owner = auth.uid();
$$;

-- ---------- chat: a world room and one per city ----------
create table if not exists public.cs_chat (
  id bigint generated always as identity primary key,
  room text not null check (room in ('global', 'nyc', 'london', 'tokyo', 'hongkong', 'dubai')),
  player uuid not null default auth.uid() references public.cs_players (id) on delete cascade,
  name text not null default '',
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);
create index if not exists cs_chat_room on public.cs_chat (room, created_at desc);
alter table public.cs_chat enable row level security;
drop policy if exists "chat is public" on public.cs_chat;
create policy "chat is public" on public.cs_chat for select using (true);
drop policy if exists "you post as yourself" on public.cs_chat;
create policy "you post as yourself" on public.cs_chat for insert to authenticated with check ((select auth.uid()) = player);

-- the sender's current name is filled in by the server, and one message every 1.5 seconds is the most anyone can send
create or replace function public.cs_chat_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select name into new.name from public.cs_players where id = new.player;
  if new.name is null then raise exception 'Pick a player name first'; end if;
  if exists (select 1 from public.cs_chat where player = new.player and created_at > now() - interval '1.5 seconds') then
    raise exception 'Slow down: one message every couple of seconds';
  end if;
  new.body := btrim(regexp_replace(new.body, '[[:cntrl:]]', ' ', 'g'));
  new.created_at := now();
  return new;
end $$;
drop trigger if exists cs_chat_before_insert on public.cs_chat;
create trigger cs_chat_before_insert before insert on public.cs_chat for each row execute function public.cs_chat_before_insert();

-- ---------- cloud saves: your game follows your account to every device ----------
-- one row per player, holding the game's own save (cash, shares, loans, buildings, office, staff). Only you can read
-- or write yours. It goes when your player does (delete my account).
create table if not exists public.cs_saves (
  player uuid primary key default auth.uid() references public.cs_players (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and octet_length(data::text) <= 1000000),
  updated_at timestamptz not null default now()
);
alter table public.cs_saves enable row level security;
drop policy if exists "read own save" on public.cs_saves;
create policy "read own save" on public.cs_saves for select to authenticated using ((select auth.uid()) = player);
drop policy if exists "add own save" on public.cs_saves;
create policy "add own save" on public.cs_saves for insert to authenticated with check ((select auth.uid()) = player);
drop policy if exists "update own save" on public.cs_saves;
create policy "update own save" on public.cs_saves for update to authenticated using ((select auth.uid()) = player) with check ((select auth.uid()) = player);
revoke all on public.cs_saves from anon;

-- the server stamps the time, so "which save is newer" can't be faked by a device's clock
create or replace function public.cs_saves_stamp()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists cs_saves_stamp on public.cs_saves;
create trigger cs_saves_stamp before insert or update on public.cs_saves for each row execute function public.cs_saves_stamp();
revoke all on function public.cs_saves_stamp() from public, anon, authenticated;

-- ---------- trading between players: sales, auctions and a goods exchange ----------
-- Cash still lives in each player's own save (see the note at the top), so the server moves ownership and goods and
-- writes down who owes whom in cs_inbox; each game collects its own inbox and adjusts its own cash.

-- money and goods owed to a player, collected by their game
create table if not exists public.cs_inbox (
  id bigint generated always as identity primary key,
  player uuid not null references public.cs_players (id) on delete cascade,
  kind text not null check (kind in ('sold', 'won', 'goods', 'cash', 'note')),
  cash numeric not null default 0 check (cash between -1e12 and 1e12), -- negative: you owe it (an auction you won)
  good text check (good in ('crates', 'ore', 'oil', 'food', 'steel', 'fuel', 'machines')),
  qty int not null default 0 check (qty between 0 and 10000000),
  city text, building text, floors int, name text,
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  collected boolean not null default false
);
create index if not exists cs_inbox_player on public.cs_inbox (player) where not collected;
alter table public.cs_inbox enable row level security;
drop policy if exists "you read your own inbox" on public.cs_inbox;
create policy "you read your own inbox" on public.cs_inbox for select to authenticated using ((select auth.uid()) = player);

create or replace function public.cs_collect_inbox()
returns setof public.cs_inbox language sql security definer set search_path = '' as $$
  update public.cs_inbox set collected = true where player = auth.uid() and not collected returning *;
$$;

-- buildings and plots for sale to other players at a fixed price
create table if not exists public.cs_listings (
  city text not null check (city in ('nyc', 'london', 'tokyo', 'hongkong', 'dubai')),
  building text not null check (char_length(building) between 1 and 40),
  seller uuid not null references public.cs_players (id) on delete cascade,
  price numeric not null check (price > 0 and price <= 1e10),
  floors int not null check (floors between 1 and 300),
  name text check (char_length(name) <= 80),
  created_at timestamptz not null default now(),
  primary key (city, building)
);
create index if not exists cs_listings_seller on public.cs_listings (seller);
alter table public.cs_listings enable row level security;
drop policy if exists "listings are public" on public.cs_listings;
create policy "listings are public" on public.cs_listings for select using (true);

-- auctions between players, and the bids on them: nobody sees anyone else's maximum
create table if not exists public.cs_pauctions (
  id bigint generated always as identity primary key,
  city text not null check (city in ('nyc', 'london', 'tokyo', 'hongkong', 'dubai')),
  building text not null check (char_length(building) between 1 and 40),
  seller uuid not null references public.cs_players (id) on delete cascade,
  name text check (char_length(name) <= 80),
  floors int not null check (floors between 1 and 300),
  opening numeric not null check (opening > 0 and opening <= 1e10),
  ends_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'sold', 'unsold')),
  winner uuid references public.cs_players (id) on delete set null,
  price numeric,
  created_at timestamptz not null default now()
);
create unique index if not exists cs_pauctions_open on public.cs_pauctions (city, building) where status = 'open';
create index if not exists cs_pauctions_seller on public.cs_pauctions (seller);
create index if not exists cs_pauctions_winner on public.cs_pauctions (winner);
alter table public.cs_pauctions enable row level security;
drop policy if exists "auctions are public" on public.cs_pauctions;
create policy "auctions are public" on public.cs_pauctions for select using (true);

create table if not exists public.cs_pbids (
  auction bigint not null references public.cs_pauctions (id) on delete cascade,
  bidder uuid not null references public.cs_players (id) on delete cascade,
  max numeric not null check (max > 0 and max <= 1e10),
  at timestamptz not null default now(),
  primary key (auction, bidder)
);
create index if not exists cs_pbids_bidder on public.cs_pbids (bidder);
alter table public.cs_pbids enable row level security;
drop policy if exists "you see your own bids" on public.cs_pbids;
create policy "you see your own bids" on public.cs_pbids for select to authenticated using ((select auth.uid()) = bidder);

-- the goods exchange: an order book where players set every price
create table if not exists public.cs_orders (
  id bigint generated always as identity primary key,
  player uuid not null references public.cs_players (id) on delete cascade,
  side text not null check (side in ('buy', 'sell')),
  good text not null check (good in ('crates', 'ore', 'oil', 'food', 'steel', 'fuel', 'machines')),
  qty int not null check (qty between 1 and 1000000),
  price numeric not null check (price > 0 and price <= 1e7),
  filled int not null default 0 check (filled >= 0),
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists cs_orders_book on public.cs_orders (good, side, price) where status = 'open';
create index if not exists cs_orders_player on public.cs_orders (player);
alter table public.cs_orders enable row level security;
drop policy if exists "the order book is public" on public.cs_orders;
create policy "the order book is public" on public.cs_orders for select using (true);

-- one bidding step: about 1% of the opening bid, at least $10
create or replace function public.cs_pstep(p numeric)
returns numeric language sql immutable set search_path = '' as $$ select greatest(10, round(p * 0.01)) $$;

-- ---------- selling to players ----------
create or replace function public.cs_list_property(p_city text, p_building text, p_price numeric)
returns public.cs_listings language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); b public.cs_buildings; r public.cs_listings;
begin
  select * into b from public.cs_buildings where city = p_city and building = p_building;
  if b.owner is distinct from me then raise exception 'You don''t own this'; end if;
  if exists (select 1 from public.cs_pauctions where city = p_city and building = p_building and status = 'open') then raise exception 'It is up for auction'; end if;
  if (select count(*) from public.cs_listings where seller = me and not (city = p_city and building = p_building)) >= 20 then raise exception 'You can list up to 20 at a time'; end if;
  insert into public.cs_listings as l (city, building, seller, price, floors, name) values (p_city, p_building, me, round(p_price, 2), b.floors, b.name)
  on conflict (city, building) do update set price = excluded.price, seller = excluded.seller, floors = excluded.floors, name = excluded.name, created_at = now()
  returning * into r;
  return r;
end $$;

create or replace function public.cs_unlist_property(p_city text, p_building text)
returns void language sql security definer set search_path = '' as $$
  delete from public.cs_listings where city = p_city and building = p_building and seller = auth.uid();
$$;

-- buy a listing at the price you saw: the building is yours, the seller's inbox gets the money
create or replace function public.cs_buy_listing(p_city text, p_building text, p_price numeric)
returns public.cs_listings language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); l public.cs_listings; b public.cs_buildings;
begin
  if not exists (select 1 from public.cs_players where id = me) then raise exception 'Pick a player name first'; end if;
  select * into l from public.cs_listings where city = p_city and building = p_building for update;
  if l.seller is null then raise exception 'No longer for sale'; end if;
  if l.seller = me then raise exception 'That is your own listing'; end if;
  if l.price <> round(p_price, 2) then raise exception 'The price changed'; end if;
  select * into b from public.cs_buildings where city = p_city and building = p_building for update;
  if b.owner is distinct from l.seller then raise exception 'No longer for sale'; end if;
  update public.cs_buildings set owner = me, bought_at = now() where city = p_city and building = p_building;
  delete from public.cs_listings where city = p_city and building = p_building;
  insert into public.cs_inbox (player, kind, cash, city, building, floors, name, note)
    values (l.seller, 'sold', l.price, p_city, p_building, b.floors, b.name, 'Sold to ' || (select name from public.cs_players where id = me));
  return l;
end $$;

-- ---------- auctions between players ----------
create or replace function public.cs_start_auction(p_city text, p_building text, p_opening numeric, p_hours int)
returns public.cs_pauctions language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); b public.cs_buildings; r public.cs_pauctions;
begin
  select * into b from public.cs_buildings where city = p_city and building = p_building;
  if b.owner is distinct from me then raise exception 'You don''t own this'; end if;
  if p_hours not between 1 and 72 then raise exception 'An auction runs 1 to 72 hours'; end if;
  if exists (select 1 from public.cs_pauctions where city = p_city and building = p_building and status = 'open') then raise exception 'It is already up for auction'; end if;
  if (select count(*) from public.cs_pauctions where seller = me and status = 'open') >= 5 then raise exception 'You can run up to 5 auctions at a time'; end if;
  delete from public.cs_listings where city = p_city and building = p_building;
  insert into public.cs_pauctions (city, building, seller, name, floors, opening, ends_at)
    values (p_city, p_building, me, b.name, b.floors, round(p_opening, 2), now() + make_interval(hours => p_hours))
  returning * into r;
  return r;
end $$;

-- what anyone may know about the open auctions in a city: the price, who leads, how many bid, your own maximum
create or replace function public.cs_auctions_open(p_city text)
returns table (id bigint, building text, name text, floors int, seller text, seller_is_me boolean, opening numeric, ends_at timestamptz,
  price numeric, step numeric, leader text, leader_is_me boolean, bidders int, my_max numeric)
language sql stable security definer set search_path = '' as $$
  select a.id, a.building, a.name, a.floors, s.name, a.seller = auth.uid(), a.opening, a.ends_at,
    case when t.bidder is null or t2.max is null then a.opening else least(t.max, t2.max + public.cs_pstep(a.opening)) end,
    public.cs_pstep(a.opening), tp.name, coalesce(t.bidder = auth.uid(), false), coalesce(c.n, 0)::int, m.max
  from public.cs_pauctions a
  join public.cs_players s on s.id = a.seller
  left join lateral (select b.bidder, b.max from public.cs_pbids b where b.auction = a.id order by b.max desc, b.at asc limit 1) t on true
  left join lateral (select b.max from public.cs_pbids b where b.auction = a.id order by b.max desc, b.at asc offset 1 limit 1) t2 on true
  left join public.cs_players tp on tp.id = t.bidder
  left join lateral (select count(*) as n from public.cs_pbids b where b.auction = a.id) c on true
  left join lateral (select b.max from public.cs_pbids b where b.auction = a.id and b.bidder = auth.uid()) m on true
  where a.city = p_city and a.status = 'open' and a.ends_at > now()
  order by a.ends_at;
$$;

-- set or raise your maximum; a bid in the last two minutes pushes the end back to two minutes from now
create or replace function public.cs_bid(p_auction bigint, p_max numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); a public.cs_pauctions; lead uuid; topmax numeric; secmax numeric; cur numeric; stp numeric;
begin
  if not exists (select 1 from public.cs_players where id = me) then raise exception 'Pick a player name first'; end if;
  select * into a from public.cs_pauctions where id = p_auction for update;
  if a.id is null or a.status <> 'open' or a.ends_at <= now() then raise exception 'This auction has ended'; end if;
  if a.seller = me then raise exception 'You can''t bid on your own auction'; end if;
  select b.bidder, b.max into lead, topmax from public.cs_pbids b where b.auction = p_auction order by b.max desc, b.at asc limit 1;
  select b.max into secmax from public.cs_pbids b where b.auction = p_auction order by b.max desc, b.at asc offset 1 limit 1;
  stp := public.cs_pstep(a.opening);
  cur := case when lead is null or secmax is null then a.opening else least(topmax, secmax + stp) end;
  if p_max < a.opening then raise exception 'The opening bid is $%', a.opening; end if;
  if lead is not null and lead <> me and p_max < cur + stp then raise exception 'Bid at least $%', cur + stp; end if;
  if lead = me and p_max < cur then raise exception 'You can''t go below the current bid of $%', cur; end if;
  insert into public.cs_pbids as x (auction, bidder, max) values (p_auction, me, round(p_max, 2))
  on conflict (auction, bidder) do update set max = excluded.max;
  update public.cs_pauctions set ends_at = greatest(ends_at, now() + interval '2 minutes') where id = p_auction;
end $$;

-- settle every auction that has ended: anyone's game may call it, it only ever does what the rules say
create or replace function public.cs_settle_due()
returns int language plpgsql security definer set search_path = '' as $$
declare
  a public.cs_pauctions; b public.cs_buildings; lead uuid; topmax numeric; secmax numeric; v_price numeric; n int := 0;
begin
  for a in select * from public.cs_pauctions where status = 'open' and ends_at <= now() for update skip locked loop
    lead := null; topmax := null; secmax := null;
    select x.bidder, x.max into lead, topmax from public.cs_pbids x where x.auction = a.id order by x.max desc, x.at asc limit 1;
    select x.max into secmax from public.cs_pbids x where x.auction = a.id order by x.max desc, x.at asc offset 1 limit 1;
    select * into b from public.cs_buildings where city = a.city and building = a.building for update;
    if lead is null or b.owner is distinct from a.seller then
      update public.cs_pauctions set status = 'unsold' where id = a.id;
      insert into public.cs_inbox (player, kind, city, building, name, note)
        values (a.seller, 'note', a.city, a.building, a.name, case when lead is null then 'No bids on ' else 'Auction called off for ' end || coalesce(a.name, a.building));
    else
      v_price := case when secmax is null then a.opening else least(topmax, secmax + public.cs_pstep(a.opening)) end;
      update public.cs_buildings set owner = lead, bought_at = now() where city = a.city and building = a.building;
      update public.cs_pauctions set status = 'sold', winner = lead, price = v_price where id = a.id;
      delete from public.cs_listings where city = a.city and building = a.building;
      insert into public.cs_inbox (player, kind, cash, city, building, floors, name, note) values
        (a.seller, 'sold', v_price, a.city, a.building, b.floors, a.name, 'Sold at auction to ' || (select name from public.cs_players where id = lead)),
        (lead, 'won', -v_price, a.city, a.building, b.floors, a.name, 'You won the auction for ' || coalesce(a.name, a.building));
      insert into public.cs_inbox (player, kind, city, building, name, note)
        select x.bidder, 'note', a.city, a.building, a.name, 'Outbid on ' || coalesce(a.name, a.building) from public.cs_pbids x where x.auction = a.id and x.bidder <> lead;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------- the goods exchange ----------
-- place an order; it trades at once with any order already waiting at the same price or better (at that order's
-- price), and the rest waits in the book. The other side of each trade finds its cash or goods in its inbox.
create or replace function public.cs_place_order(p_side text, p_good text, p_qty int, p_price numeric)
returns table (out_filled int, out_total numeric, out_id bigint)
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); o public.cs_orders; r public.cs_orders; left_qty int; q int; v_filled int := 0; v_total numeric := 0;
begin
  if not exists (select 1 from public.cs_players where id = me) then raise exception 'Pick a player name first'; end if;
  if (select count(*) from public.cs_orders where player = me and status = 'open') >= 20 then raise exception 'You can have up to 20 open orders'; end if;
  insert into public.cs_orders (player, side, good, qty, price) values (me, p_side, p_good, p_qty, round(p_price, 2)) returning * into o;
  left_qty := o.qty;
  for r in select * from public.cs_orders x
      where x.status = 'open' and x.good = o.good and x.side <> o.side and x.player <> me
        and (case when o.side = 'buy' then x.price <= o.price else x.price >= o.price end)
      order by case when o.side = 'buy' then x.price end asc, case when o.side = 'sell' then x.price end desc, x.created_at
      for update skip locked loop
    exit when left_qty <= 0;
    q := least(left_qty, r.qty - r.filled);
    update public.cs_orders set filled = filled + q, status = case when filled + q >= qty then 'done' else 'open' end where id = r.id;
    left_qty := left_qty - q; v_filled := v_filled + q; v_total := v_total + q * r.price;
    if o.side = 'buy' then
      insert into public.cs_inbox (player, kind, cash, good, note) values (r.player, 'cash', q * r.price, o.good, 'Sold ' || q || ' ' || o.good || ' on the exchange');
    else
      insert into public.cs_inbox (player, kind, good, qty, note) values (r.player, 'goods', o.good, q, 'Bought ' || q || ' ' || o.good || ' on the exchange');
    end if;
  end loop;
  update public.cs_orders set filled = v_filled, status = case when v_filled >= qty then 'done' else 'open' end where id = o.id;
  return query select v_filled, v_total, o.id;
end $$;

-- cancel what's left of your order; your game gives you back the goods or cash it was holding for it
create or replace function public.cs_cancel_order(p_id bigint)
returns table (out_side text, out_good text, out_left int, out_price numeric)
language sql security definer set search_path = '' as $$
  update public.cs_orders set status = 'cancelled' where id = p_id and player = auth.uid() and status = 'open'
  returning side, good, qty - filled, price;
$$;

revoke all on function public.cs_collect_inbox() from public, anon;
revoke all on function public.cs_list_property(text, text, numeric) from public, anon;
revoke all on function public.cs_unlist_property(text, text) from public, anon;
revoke all on function public.cs_buy_listing(text, text, numeric) from public, anon;
revoke all on function public.cs_start_auction(text, text, numeric, int) from public, anon;
revoke all on function public.cs_bid(bigint, numeric) from public, anon;
revoke all on function public.cs_settle_due() from public, anon;
revoke all on function public.cs_place_order(text, text, int, numeric) from public, anon;
revoke all on function public.cs_cancel_order(bigint) from public, anon;
revoke all on function public.cs_pstep(numeric) from public, anon, authenticated;
grant execute on function public.cs_collect_inbox() to authenticated;
grant execute on function public.cs_list_property(text, text, numeric) to authenticated;
grant execute on function public.cs_unlist_property(text, text) to authenticated;
grant execute on function public.cs_buy_listing(text, text, numeric) to authenticated;
grant execute on function public.cs_start_auction(text, text, numeric, int) to authenticated;
grant execute on function public.cs_bid(bigint, numeric) to authenticated;
grant execute on function public.cs_settle_due() to authenticated;
grant execute on function public.cs_place_order(text, text, int, numeric) to authenticated;
grant execute on function public.cs_cancel_order(bigint) to authenticated;
grant execute on function public.cs_auctions_open(text) to anon, authenticated;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'cs_inbox') then alter publication supabase_realtime add table public.cs_inbox; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'cs_listings') then alter publication supabase_realtime add table public.cs_listings; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'cs_pauctions') then alter publication supabase_realtime add table public.cs_pauctions; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'cs_orders') then alter publication supabase_realtime add table public.cs_orders; end if;
end $$;
alter table public.cs_listings replica identity full; -- so a sale says which building left the list

-- ---------- your account ----------
-- deletes your login, player, buildings, messages, cloud save, listings, auctions, bids, orders and inbox
create or replace function public.cs_delete_me()
returns void language sql security definer set search_path = '' as $$
  delete from auth.users where id = auth.uid();
$$;

-- only signed-in players may call the functions
revoke all on function public.cs_claim_building(text, text, int, text) from public, anon;
revoke all on function public.cs_release_building(text, text) from public, anon;
revoke all on function public.cs_delete_me() from public, anon;
revoke all on function public.cs_chat_before_insert() from public, anon, authenticated;
grant execute on function public.cs_claim_building(text, text, int, text) to authenticated;
grant execute on function public.cs_release_building(text, text) to authenticated;
grant execute on function public.cs_delete_me() to authenticated;

-- ---------- live updates ----------
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'cs_buildings') then
    alter publication supabase_realtime add table public.cs_buildings;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'cs_chat') then
    alter publication supabase_realtime add table public.cs_chat;
  end if;
end $$;
