-- Capital Island economy, version 2 (Goal 37): more than one way to earn. Run island.sql first: this file adds to it and
-- replaces the functions that had to change (ci_state, ci_finish, ci_ship, ci_grow, ci_process, ci_buy_property, ci_buy_listing).
-- Nothing is dropped, and the old game keeps working against it. Safe to run more than once.
--   - wholesale goods (goods, fuel): the harbour depot sells; the shops, the hotel, the co-op and the plant buy. Each holds a
--     finite stock or demand, shared by every player, that refills with time; prices move with how full it is, so buying low and
--     selling high empties the shelf and fills the buyer
--   - delivery contracts: two are posted every 2 minutes (from the clock alone); the first player to take one carries it and is
--     paid on arrival; the cargo comes from the business that posted it
--   - a ledger of every change to a player's cash, written by the database itself
--   - bookings carry an id the game makes up, so a retry after a dropped connection books once, not twice
-- The arithmetic is the same as island/sample/market.js (whole cents, whole units); a test checks both give the same answers.

-- ---------- tables ----------
create table if not exists public.ci_inv ( -- wholesale goods a player holds, at a place
  player uuid not null references public.ci_players (id) on delete cascade,
  site text not null, good text not null check (good in ('goods', 'fuel')),
  qty int not null default 0 check (qty >= 0), cost numeric(14, 2) not null default 0 check (cost >= 0),
  primary key (player, site, good)
);
create table if not exists public.ci_market ( -- the island's businesses that buy and sell the wholesale goods
  biz text primary key, name text not null, node text not null, side text not null check (side in ('sell', 'buy')), good text not null,
  qty numeric not null, cap int not null, refill_s numeric not null, base int not null, min_level int not null default 0, -- base: cents at half full
  updated_at timestamptz not null default now()
);
create table if not exists public.ci_tpl ( -- the kinds of delivery contract that get posted
  tpl int primary key, from_node text not null, to_node text not null, good text not null, lo int not null, hi int not null, min_level int not null
);
create table if not exists public.ci_contracts (
  id text primary key, slot bigint not null, tpl int not null, good text not null, from_node text not null, to_node text not null,
  qty int not null, reward numeric(10, 2) not null, min_level int not null, posted_at timestamptz not null, expires_at timestamptz not null,
  taker uuid references public.ci_players (id) on delete set null, taken_at timestamptz, trip uuid
);
create table if not exists public.ci_ledger (
  id bigint generated always as identity primary key, player uuid not null references public.ci_players (id) on delete cascade,
  at timestamptz not null default now(), note text not null, amount numeric(14, 2) not null, cash numeric(14, 2) not null
);
create index if not exists ci_ledger_player on public.ci_ledger (player, id desc);
create table if not exists public.ci_ops ( -- bookings already made
  id uuid primary key, player uuid not null, kind text not null, at timestamptz not null default now()
);

-- a trip can now carry goods and fuel, or be a contract, and its buyer is any business
alter table public.ci_shipments add column if not exists good text, add column if not exists contract text, add column if not exists reward numeric(14, 2);
do $$ declare c record; begin
  for c in select conname from pg_constraint where conrelid = 'public.ci_shipments'::regclass
           and ((contype = 'c' and pg_get_constraintdef(oid) ~ 'kind') or (contype = 'f' and pg_get_constraintdef(oid) ~ 'ci_buyers')) loop
    execute format('alter table public.ci_shipments drop constraint %I', c.conname);
  end loop;
  alter table public.ci_shipments add constraint ci_shipments_kind_check check (kind in ('crop', 'food', 'goods', 'fuel', 'contract'));
end $$;

-- ---------- who can read what ----------
alter table public.ci_inv enable row level security;
alter table public.ci_market enable row level security;
alter table public.ci_tpl enable row level security;
alter table public.ci_contracts enable row level security;
alter table public.ci_ledger enable row level security;
alter table public.ci_ops enable row level security; -- no policy: nobody reads it
drop policy if exists "your own goods" on public.ci_inv; create policy "your own goods" on public.ci_inv for select to authenticated using ((select auth.uid()) = player);
drop policy if exists "the market is public" on public.ci_market; create policy "the market is public" on public.ci_market for select using (true);
drop policy if exists "templates are public" on public.ci_tpl; create policy "templates are public" on public.ci_tpl for select using (true);
drop policy if exists "contracts are public" on public.ci_contracts; create policy "contracts are public" on public.ci_contracts for select using (true);
drop policy if exists "your own ledger" on public.ci_ledger; create policy "your own ledger" on public.ci_ledger for select to authenticated using ((select auth.uid()) = player);
do $$ declare t text; begin
  foreach t in array array['ci_market', 'ci_contracts'] loop
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- the island's fixed data ----------
insert into public.ci_routes (from_node, to_node, meters) values
  ('FA', 'P', 867), ('FA', 'C', 563), ('FA', 'J', 502), ('FA', 'K', 655), ('P', 'FA', 867), ('P', 'C', 612), ('P', 'J', 767), ('P', 'K', 469),
  ('C', 'FA', 563), ('C', 'P', 612), ('C', 'J', 155), ('C', 'K', 178), ('J', 'FA', 503), ('J', 'P', 768), ('J', 'C', 156), ('J', 'K', 334),
  ('K', 'FA', 655), ('K', 'P', 469), ('K', 'C', 178), ('K', 'J', 333)
on conflict (from_node, to_node) do update set meters = excluded.meters;
insert into public.ci_market (biz, name, node, side, good, qty, cap, refill_s, base, min_level) values
  ('harbour-goods', 'Harbour depot', 'K', 'sell', 'goods', 60, 60, 20, 2600, 0),
  ('harbour-fuel', 'Harbour depot', 'K', 'sell', 'fuel', 80, 80, 12, 1200, 0),
  ('shops-goods', 'Old Quarter shops', 'C', 'buy', 'goods', 40, 40, 15, 3300, 0),
  ('hotel-goods', 'Hotel Azure', 'J', 'buy', 'goods', 20, 20, 20, 3500, 2),
  ('hotel-fuel', 'Hotel Azure', 'J', 'buy', 'fuel', 30, 30, 15, 1600, 2),
  ('coop-fuel', 'Greenfields Co-op', 'FA', 'buy', 'fuel', 40, 40, 12, 1700, 0),
  ('plant-fuel', 'Processing Plant', 'P', 'buy', 'fuel', 50, 50, 12, 1600, 0)
on conflict (biz) do update set name = excluded.name, node = excluded.node, side = excluded.side, good = excluded.good, cap = excluded.cap,
  refill_s = excluded.refill_s, base = excluded.base, min_level = excluded.min_level; -- stock and demand keep what they have
insert into public.ci_tpl (tpl, from_node, to_node, good, lo, hi, min_level) values
  (0, 'FA', 'P', 'crop', 20, 40, 0), (1, 'P', 'C', 'food', 10, 20, 0), (2, 'P', 'J', 'food', 10, 20, 2), (3, 'K', 'C', 'goods', 10, 20, 0),
  (4, 'K', 'J', 'goods', 8, 16, 2), (5, 'K', 'FA', 'fuel', 10, 20, 0), (6, 'FA', 'K', 'crop', 20, 40, 1), (7, 'P', 'K', 'food', 10, 20, 1)
on conflict (tpl) do update set from_node = excluded.from_node, to_node = excluded.to_node, good = excluded.good, lo = excluded.lo, hi = excluded.hi, min_level = excluded.min_level;

-- ---------- rules ----------
-- integer division, halves rounded up
create or replace function public.ci_rdiv(a bigint, b bigint) returns bigint language sql immutable set search_path = '' as $$ select (2 * a + b) / (2 * b) $$;
-- the price of one unit in cents with q units in stock (sell) or still wanted (buy)
create or replace function public.ci_unit_cents(p_side text, p_base int, p_cap int, p_q int) returns bigint language sql immutable set search_path = '' as $$
  select case when p_side = 'sell' then public.ci_rdiv(p_base::bigint * (250 * p_cap - 100 * p_q), 200 * p_cap) else public.ci_rdiv(p_base::bigint * (150 * p_cap + 100 * p_q), 200 * p_cap) end $$;
-- the price of n units in cents: the average of the price before and after
create or replace function public.ci_total_cents(p_side text, p_base int, p_cap int, p_q int, p_n int) returns bigint language sql immutable set search_path = '' as $$
  select case when p_side = 'sell' then public.ci_rdiv(p_n::bigint * p_base * (250 * p_cap - 50 * (2 * p_q - p_n)), 200 * p_cap)
              else public.ci_rdiv(p_n::bigint * p_base * (150 * p_cap + 50 * (2 * p_q - p_n)), 200 * p_cap) end $$;
-- whole units a business has now: stock or demand creeps back up to its cap
create or replace function public.ci_units(m public.ci_market) returns int language sql stable set search_path = '' as $$
  select floor(least(m.cap, m.qty + greatest(0, extract(epoch from (now() - m.updated_at))) / m.refill_s) + 0.000000001)::int $$;
create or replace function public.ci_what(p_good text, p_qty int) returns text language sql immutable set search_path = '' as $$
  select p_qty || ' ' || case p_good when 'crop' then case when p_qty = 1 then 'crate' else 'crates' end || ' of crops' when 'food' then case when p_qty = 1 then 'box' else 'boxes' end || ' of food'
    when 'goods' then case when p_qty = 1 then 'carton' else 'cartons' end || ' of goods' else case when p_qty = 1 then 'drum' else 'drums' end || ' of fuel' end $$;
create or replace function public.ci_note(p_note text) returns void language sql volatile set search_path = '' as $$ select set_config('ci.note', p_note, true) $$; -- what the next change to cash is for

-- every change to a player's cash is written to the ledger, with the note set just before it
create or replace function public.ci_ledger_trg() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.cash is distinct from old.cash then
    insert into public.ci_ledger (player, note, amount, cash)
      values (new.id, coalesce(nullif(current_setting('ci.note', true), ''), case when new.cash > old.cash then 'Money received' else 'Money paid' end), new.cash - old.cash, new.cash);
    perform set_config('ci.note', '', true);
    delete from public.ci_ledger where player = new.id and id <= (select id from public.ci_ledger where player = new.id order by id desc offset 200 limit 1);
  end if;
  return new;
end $$;
drop trigger if exists ci_ledger on public.ci_players;
create trigger ci_ledger after update of cash on public.ci_players for each row execute function public.ci_ledger_trg();

-- the contracts posted in one 2-minute slot: two of them, worked out from the slot number alone
create or replace function public.ci_posted(p_slot bigint, p_n int) returns jsonb language plpgsql stable set search_path = '' as $$
declare h1 bigint := (p_slot * 48271 + 12345) % 2147483647; h2 bigint; h3 bigint; t public.ci_tpl; m int; q int;
begin
  h2 := (h1 * 16807 + (p_n + 1) * 69621 + 7) % 2147483647; h3 := (h2 * 48271 + 99) % 2147483647;
  select * into t from public.ci_tpl where ci_tpl.tpl = (h2 % 8)::int;
  q := t.lo + ((h3 % ((t.hi - t.lo) / 2 + 1)) * 2)::int;
  select r.meters::int into m from public.ci_routes r where r.from_node = t.from_node and r.to_node = t.to_node;
  return jsonb_build_object('id', 's' || p_slot || '-' || p_n, 'slot', p_slot, 'tpl', t.tpl, 'good', t.good, 'from_node', t.from_node, 'to_node', t.to_node,
    'qty', q, 'meters', m, 'reward', 10 + (4 * m + 45 * q + 50) / 100, 'min_level', t.min_level);
end $$;
create or replace function public.ci_board() returns void language plpgsql security definer set search_path = '' as $$
declare s bigint := floor(extract(epoch from now()) / 120)::bigint; k bigint; n int; c jsonb;
begin
  for k in s - 3 .. s loop for n in 0 .. 1 loop
    c := public.ci_posted(k, n);
    insert into public.ci_contracts (id, slot, tpl, good, from_node, to_node, qty, reward, min_level, posted_at, expires_at)
      values (c ->> 'id', k, (c ->> 'tpl')::int, c ->> 'good', c ->> 'from_node', c ->> 'to_node', (c ->> 'qty')::int, (c ->> 'reward')::numeric, (c ->> 'min_level')::int,
              to_timestamp(k * 120), to_timestamp(k * 120 + 480))
      on conflict (id) do nothing;
  end loop; end loop;
end $$;

-- take goods out of a place, with their share of what they cost
create or replace function public.ci_take_inv(p uuid, p_site text, p_good text, p_qty int) returns numeric language plpgsql security definer set search_path = '' as $$
declare st public.ci_inv; basis numeric;
begin
  select * into st from public.ci_inv where player = p and site = p_site and good = p_good for update;
  if not found or st.qty < p_qty then raise exception 'Not enough in your warehouse'; end if;
  basis := round(st.cost * p_qty / st.qty, 2);
  update public.ci_inv set qty = qty - p_qty, cost = case when qty - p_qty = 0 then 0 else greatest(0, cost - basis) end where player = p and site = p_site and good = p_good;
  return basis;
end $$;

-- a trip arrives: once only (replaces the version in island.sql: goods, fuel and contracts are paid here too)
create or replace function public.ci_finish(p_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.ci_shipments; rev numeric; profit numeric; gained int; who text;
begin
  update public.ci_shipments set status = 'delivered', delivered_at = now() where id = p_id and status = 'travelling' returning * into s;
  if not found then return null; end if; -- already delivered: no second reward
  if s.kind = 'crop' then
    insert into public.ci_stock as st (player, site, qty, cost) values (s.player, 'plant_in', s.qty, s.basis + s.fee)
      on conflict (player, site) do update set qty = st.qty + excluded.qty, cost = st.cost + excluded.cost;
    return jsonb_build_object('kind', 'crop', 'qty', s.qty);
  end if;
  if s.kind = 'contract' then
    gained := least(25, floor(s.reward / 8))::int;
    perform public.ci_note('Contract: carried ' || public.ci_what(s.good, s.qty));
    update public.ci_players set cash = cash + s.reward, xp = xp + gained where id = s.player;
    return jsonb_build_object('kind', 'contract', 'good', s.good, 'qty', s.qty, 'revenue', s.reward, 'profit', s.reward, 'xp', gained);
  end if;
  rev := coalesce(s.reward, s.qty * s.price); profit := rev - s.basis - s.fee; gained := least(60, greatest(0, floor(profit / 10)))::int; -- XP from real profit, capped per delivery
  select coalesce((select m.name from public.ci_market m where m.biz = s.buyer), (select b.name from public.ci_buyers b where b.buyer = s.buyer), 'a buyer') into who;
  perform public.ci_note('Sold ' || public.ci_what(coalesce(s.good, s.kind), s.qty) || ' to ' || who);
  update public.ci_players set cash = cash + rev, xp = xp + gained where id = s.player;
  return jsonb_build_object('kind', s.kind, 'good', coalesce(s.good, s.kind), 'qty', s.qty, 'revenue', rev, 'profit', profit, 'xp', gained);
end $$;

-- everything the game shows, in one answer (the same keys as before, and v2 for the new economy)
create or replace function public.ci_state() returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me();
begin
  perform public.ci_settle(u);
  perform public.ci_board();
  update public.ci_players set last_seen = now() where id = u;
  return jsonb_build_object(
    'now', now(),
    'player', (select to_jsonb(p) from public.ci_players p where p.id = u),
    'stock', coalesce((select jsonb_object_agg(site, jsonb_build_object('qty', qty, 'cost', cost)) from public.ci_stock where player = u), '{}'::jsonb),
    'jobs', coalesce((select jsonb_agg(to_jsonb(j) order by j.ends_at) from public.ci_jobs j where j.player = u and not j.done), '[]'::jsonb),
    'ships', coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at) from public.ci_shipments s where s.player = u and (s.status <> 'delivered' or s.delivered_at > now() - interval '60 seconds')), '[]'::jsonb),
    'buyers', (select jsonb_agg(jsonb_build_object('buyer', b.buyer, 'name', b.name, 'demand', public.ci_demand(b), 'max', b.max_demand, 'price', public.ci_price(b), 'min_level', b.min_level)) from public.ci_buyers b),
    'routes', (select jsonb_agg(to_jsonb(r)) from public.ci_routes r),
    'property', coalesce((select jsonb_agg(jsonb_build_object('lot', pr.lot, 'owner', pr.owner, 'name', pl.name, 'color', pl.color)) from public.ci_property pr join public.ci_players pl on pl.id = pr.owner), '[]'::jsonb),
    'listings', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'seller', l.seller, 'name', pl.name, 'qty', l.qty, 'price', l.price) order by l.price, l.created_at) from public.ci_listings l join public.ci_players pl on pl.id = l.seller where l.status = 'open'), '[]'::jsonb),
    'match', public.ci_match_on(), 'match_in', 450 - mod(floor(extract(epoch from now()))::bigint, 450),
    'v2', jsonb_build_object(
      'market', coalesce((select jsonb_agg(jsonb_build_object('biz', m.biz, 'name', m.name, 'node', m.node, 'side', m.side, 'good', m.good, 'units', public.ci_units(m), 'cap', m.cap,
        'refill_s', m.refill_s, 'base', m.base, 'price', public.ci_unit_cents(m.side, m.base, m.cap, public.ci_units(m)), 'min_level', m.min_level) order by m.biz) from public.ci_market m), '[]'::jsonb),
      'inv', coalesce((select jsonb_agg(jsonb_build_object('site', i.site, 'good', i.good, 'qty', i.qty, 'cost', i.cost)) from public.ci_inv i where i.player = u and i.qty > 0), '[]'::jsonb),
      'contracts', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'good', c.good, 'from', c.from_node, 'to', c.to_node, 'qty', c.qty, 'reward', c.reward, 'level', c.min_level,
        'expires_at', c.expires_at, 'taker', c.taker, 'mine', c.taker = u) order by c.posted_at, c.id) from public.ci_contracts c where (c.taker is null and c.expires_at > now())), '[]'::jsonb),
      'ledger', coalesce((select jsonb_agg(to_jsonb(x)) from (select at, note, amount, cash from public.ci_ledger where player = u order by id desc limit 30) x), '[]'::jsonb),
      'board_in', 120 - mod(floor(extract(epoch from now()))::bigint, 120)));
end $$;

-- buy wholesale goods from a supplier (they wait in your warehouse at the supplier's place)
create or replace function public.ci_buy_goods(p_id uuid, p_biz text, p_qty int) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); m public.ci_market; lvl int; q int; total numeric; have int;
begin
  perform 1 from public.ci_players where id = u for update;
  insert into public.ci_ops (id, player, kind) values (p_id, u, 'buy') on conflict (id) do nothing;
  if not found then if (select player from public.ci_ops where id = p_id) <> u then raise exception 'Not your booking'; end if; return public.ci_state(); end if; -- the same purchase sent twice happens once
  select public.ci_level(xp) into lvl from public.ci_players where id = u;
  if p_qty is null or p_qty < 1 or p_qty > 80 then raise exception 'Buy 1 to 80 at a time'; end if;
  select * into m from public.ci_market where biz = p_biz and side = 'sell' for update; -- one buyer at a time
  if not found then raise exception 'Unknown supplier'; end if;
  if lvl < m.min_level then raise exception '% opens at level %', m.name, m.min_level + 1; end if;
  q := public.ci_units(m);
  if q < p_qty then raise exception '% only has % % right now', m.name, q, m.good; end if;
  select coalesce(max(qty), 0) into have from public.ci_inv where player = u and site = m.node and good = m.good;
  if have + p_qty > 200 then raise exception 'Your warehouse at the quay is full (200)'; end if;
  total := public.ci_total_cents('sell', m.base, m.cap, q, p_qty) / 100.0;
  perform public.ci_note('Bought ' || public.ci_what(m.good, p_qty) || ' from ' || m.name);
  update public.ci_players set cash = cash - total where id = u and cash >= total;
  if not found then perform public.ci_note(''); raise exception 'Not enough cash'; end if;
  update public.ci_market set qty = q - p_qty, updated_at = now() where biz = p_biz;
  insert into public.ci_inv as i (player, site, good, qty, cost) values (u, m.node, m.good, p_qty, total)
    on conflict (player, site, good) do update set qty = i.qty + excluded.qty, cost = i.cost + excluded.cost;
  return public.ci_state();
end $$;

-- send wholesale goods to a business that wants them: the price is fixed and the demand reserved now, you are paid on arrival
create or replace function public.ci_sell_goods(p_id uuid, p_good text, p_qty int, p_biz text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); ex public.ci_shipments; b public.ci_market; lvl int; q int; meters numeric; fee numeric; v text; total numeric; basis numeric;
begin
  select * into ex from public.ci_shipments where id = p_id;
  if found then if ex.player <> u then raise exception 'Not your shipment'; end if; return public.ci_state(); end if; -- the same booking sent twice books once
  perform 1 from public.ci_players where id = u for update;
  if exists (select 1 from public.ci_shipments where id = p_id) then return public.ci_state(); end if;
  perform public.ci_settle(u);
  select public.ci_level(xp) into lvl from public.ci_players where id = u;
  if p_good not in ('goods', 'fuel') then raise exception 'Unknown cargo'; end if;
  if p_qty is null or p_qty < 1 or p_qty > 40 then raise exception 'A vehicle takes 1 to 40'; end if;
  select * into b from public.ci_market where biz = p_biz and side = 'buy' and good = p_good for update; -- one booking at a time per buyer
  if not found then raise exception 'Unknown buyer'; end if;
  if lvl < b.min_level then raise exception '% opens at level %', b.name, b.min_level + 1; end if;
  q := public.ci_units(b);
  if q < p_qty then raise exception '% only want % more right now', b.name, q; end if;
  select r.meters into meters from public.ci_routes r where r.from_node = 'K' and r.to_node = b.node;
  v := case when p_qty <= 20 and lvl >= 1 then 'van' else 'truck' end;
  fee := round(case when v = 'van' then 8 + meters * 0.03 else 12 + meters * 0.035 end);
  total := public.ci_total_cents('buy', b.base, b.cap, q, p_qty) / 100.0;
  basis := public.ci_take_inv(u, 'K', p_good, p_qty);
  update public.ci_market set qty = q - p_qty, updated_at = now() where biz = p_biz;
  perform public.ci_note('Shipping ' || public.ci_what(p_good, p_qty) || ' to ' || b.name);
  update public.ci_players set cash = cash - fee where id = u and cash >= fee;
  if not found then perform public.ci_note(''); raise exception 'Not enough cash for the shipping'; end if;
  insert into public.ci_shipments (id, player, kind, good, buyer, from_node, to_node, qty, vehicle, fee, price, reward, basis, status)
    values (p_id, u, p_good, p_good, p_biz, 'K', b.node, p_qty, v, fee, round(total / p_qty, 2), total, basis, 'queued');
  perform public.ci_settle(u);
  return public.ci_state();
end $$;

-- take a delivery contract: whoever confirms first carries it; the cargo comes from the business that posted it
create or replace function public.ci_take_contract(p_id uuid, p_contract text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); ex public.ci_shipments; c public.ci_contracts; lvl int; v text;
begin
  select * into ex from public.ci_shipments where id = p_id;
  if found then if ex.player <> u then raise exception 'Not your shipment'; end if; return public.ci_state(); end if; -- the same request sent twice books once
  perform 1 from public.ci_players where id = u for update;
  if exists (select 1 from public.ci_shipments where id = p_id) then return public.ci_state(); end if;
  perform public.ci_board();
  select * into c from public.ci_contracts where id = p_contract for update; -- one taker at a time
  if not found then raise exception 'That contract is no longer posted'; end if;
  if c.taker is not null then raise exception 'Someone else took that contract'; end if;
  if c.expires_at <= now() then raise exception 'That contract has expired'; end if;
  perform public.ci_settle(u);
  select public.ci_level(xp) into lvl from public.ci_players where id = u;
  if lvl < c.min_level then raise exception 'That contract opens at level %', c.min_level + 1; end if;
  if (select count(*) from public.ci_shipments where player = u and kind = 'contract' and status <> 'delivered') >= 3 then raise exception 'You already have 3 contracts running'; end if;
  v := case when c.qty <= 20 and lvl >= 1 then 'van' else 'truck' end;
  update public.ci_contracts set taker = u, taken_at = now(), trip = p_id where id = p_contract;
  insert into public.ci_shipments (id, player, kind, good, contract, from_node, to_node, qty, vehicle, fee, reward, basis, status)
    values (p_id, u, 'contract', c.good, c.id, c.from_node, c.to_node, c.qty, v, 0, c.reward, 0, 'queued');
  perform public.ci_settle(u);
  return public.ci_state();
end $$;

-- the food chain's functions again, now noting what each change to cash is for (nothing else about them changed)
create or replace function public.ci_ship(p_id uuid, p_kind text, p_qty int, p_buyer text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); ex public.ci_shipments; b public.ci_buyers; lvl int; meters numeric; fee numeric; v text; dest text; price numeric; d numeric; inbound int; instore int; basis numeric;
begin
  select * into ex from public.ci_shipments where id = p_id;
  if found then if ex.player <> u then raise exception 'Not your shipment'; end if; return public.ci_state(); end if; -- the same booking sent twice books once
  perform 1 from public.ci_players where id = u for update;
  if exists (select 1 from public.ci_shipments where id = p_id) then return public.ci_state(); end if; -- a copy sent at the same moment got in first
  perform public.ci_settle(u);
  select public.ci_level(xp) into lvl from public.ci_players where id = u;
  if p_qty is null or p_qty < 1 or p_qty > 40 then raise exception 'A vehicle takes 1 to 40'; end if;
  if p_kind = 'crop' then
    dest := 'P'; v := 'truck';
    select coalesce(sum(qty), 0) into inbound from public.ci_shipments where player = u and kind = 'crop' and status <> 'delivered';
    select coalesce(max(qty), 0) into instore from public.ci_stock where player = u and site = 'plant_in';
    if instore + inbound + p_qty > 200 then raise exception 'The plant''s store is full'; end if;
    select r.meters into meters from public.ci_routes r where r.from_node = 'FA' and r.to_node = 'P';
    basis := public.ci_take(u, 'farm', p_qty);
  elsif p_kind = 'food' then
    select * into b from public.ci_buyers where buyer = p_buyer for update; -- one booking at a time per buyer
    if not found then raise exception 'Unknown buyer'; end if;
    if lvl < b.min_level then raise exception '% opens at level %', b.name, b.min_level + 1; end if;
    d := public.ci_demand(b);
    if d < p_qty then raise exception '% only want % more right now', b.name, floor(d); end if;
    price := public.ci_price(b);
    update public.ci_buyers set demand = d - p_qty, updated_at = now() where buyer = p_buyer;
    dest := case when p_buyer = 'hotel' then 'J' else 'C' end;
    v := case when p_qty <= 20 and lvl >= 1 then 'van' else 'truck' end;
    select r.meters into meters from public.ci_routes r where r.from_node = 'P' and r.to_node = dest;
    basis := public.ci_take(u, 'plant_out', p_qty);
  else
    raise exception 'Unknown cargo';
  end if;
  fee := round(case when v = 'van' then 8 + meters * 0.03 else 12 + meters * 0.035 end);
  perform public.ci_note('Shipping ' || public.ci_what(p_kind, p_qty));
  update public.ci_players set cash = cash - fee where id = u and cash >= fee;
  if not found then perform public.ci_note(''); raise exception 'Not enough cash for the shipping'; end if;
  insert into public.ci_shipments (id, player, kind, from_node, to_node, buyer, qty, vehicle, fee, price, basis, status)
    values (p_id, u, p_kind, case when p_kind = 'crop' then 'FA' else 'P' end, dest, case when p_kind = 'food' then p_buyer end, p_qty, v, fee, price, basis, 'queued');
  perform public.ci_settle(u);
  return public.ci_state();
end $$;

create or replace function public.ci_grow(p_qty int) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); lvl int; have int; growing int; cost numeric; cap int;
begin
  perform 1 from public.ci_players where id = u for update;
  perform public.ci_settle(u);
  if p_qty is null or p_qty < 1 or p_qty > 80 then raise exception 'Grow 1 to 80 crates at a time'; end if;
  select public.ci_level(xp) into lvl from public.ci_players where id = u;
  select coalesce(max(qty), 0) into have from public.ci_stock where player = u and site = 'farm';
  select coalesce(sum(qty), 0) into growing from public.ci_jobs where player = u and kind = 'grow' and not done;
  cap := case when lvl >= 3 then 240 else 120 end; -- the co-op store grows at level 4
  if have + growing + p_qty > cap then raise exception 'Not enough room at the co-op'; end if;
  cost := 3 * p_qty;
  perform public.ci_note('Seed for ' || p_qty || ' crates');
  update public.ci_players set cash = cash - cost where id = u and cash >= cost;
  if not found then perform public.ci_note(''); raise exception 'Not enough cash'; end if;
  insert into public.ci_jobs (player, kind, qty, cost, ends_at) values (u, 'grow', p_qty, cost, now() + p_qty * interval '0.8 seconds');
  return public.ci_state();
end $$;

create or replace function public.ci_process(p_qty int) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); outq int; busy int; fee numeric; basis numeric;
begin
  perform 1 from public.ci_players where id = u for update;
  perform public.ci_settle(u);
  if p_qty is null or p_qty < 1 or p_qty > 200 then raise exception 'Process 1 to 200 crates at a time'; end if;
  select coalesce(max(qty), 0) into outq from public.ci_stock where player = u and site = 'plant_out';
  select coalesce(sum(qty), 0) into busy from public.ci_jobs where player = u and kind = 'process' and not done;
  if outq + busy + p_qty > 200 then raise exception 'Not enough room for the food'; end if;
  fee := 2 * p_qty;
  perform public.ci_note('Processing ' || p_qty || ' crates');
  update public.ci_players set cash = cash - fee where id = u and cash >= fee;
  if not found then perform public.ci_note(''); raise exception 'Not enough cash'; end if;
  basis := public.ci_take(u, 'plant_in', p_qty);
  insert into public.ci_jobs (player, kind, qty, cost, ends_at) values (u, 'process', p_qty, basis + fee, now() + p_qty * interval '0.6 seconds');
  return public.ci_state();
end $$;

create or replace function public.ci_buy_property(p_lot text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); l public.ci_lots;
begin
  perform 1 from public.ci_players where id = u for update;
  select * into l from public.ci_lots where lot = p_lot;
  if not found then raise exception 'That building is not for sale'; end if;
  if exists (select 1 from public.ci_property where lot = p_lot) then raise exception 'Someone already owns this'; end if;
  perform public.ci_note('Bought a ' || split_part(p_lot, '@', 1) || ' in ' || l.area);
  update public.ci_players set cash = cash - l.price, xp = xp + 25 where id = u and cash >= l.price;
  if not found then perform public.ci_note(''); raise exception 'Not enough cash'; end if;
  begin
    insert into public.ci_property (lot, owner, price) values (p_lot, u, l.price);
  exception when unique_violation then
    raise exception 'Someone else bought it first'; -- undoes the payment too
  end;
  return public.ci_state();
end $$;

create or replace function public.ci_buy_listing(p_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); l public.ci_listings; total numeric; have int; me text; seller text;
begin
  select * into l from public.ci_listings where id = p_id for update; -- one buyer at a time
  if not found or l.status <> 'open' then raise exception 'That offer has gone'; end if;
  if l.seller = u then raise exception 'That is your own offer'; end if;
  total := l.qty * l.price;
  select coalesce(max(qty), 0) into have from public.ci_stock where player = u and site = 'plant_out';
  if have + l.qty > 200 then raise exception 'Not enough room in your plant store'; end if;
  select name into me from public.ci_players where id = u; select name into seller from public.ci_players where id = l.seller;
  perform public.ci_note('Bought ' || public.ci_what('food', l.qty) || ' from ' || seller);
  update public.ci_players set cash = cash - total where id = u and cash >= total;
  if not found then perform public.ci_note(''); raise exception 'Not enough cash'; end if;
  perform public.ci_note('Sold ' || public.ci_what('food', l.qty) || ' to ' || me);
  update public.ci_players set cash = cash + total where id = l.seller;
  update public.ci_listings set status = 'sold', buyer = u, closed_at = now() where id = p_id;
  insert into public.ci_stock as st (player, site, qty, cost) values (u, 'plant_out', l.qty, total)
    on conflict (player, site) do update set qty = st.qty + excluded.qty, cost = st.cost + excluded.cost;
  return public.ci_state();
end $$;

-- the helpers only run inside the functions above
revoke execute on function public.ci_take_inv(uuid, text, text, int) from public, anon, authenticated;
revoke execute on function public.ci_board() from public, anon, authenticated;
revoke execute on function public.ci_note(text) from public, anon, authenticated;
-- the game's own functions are for signed-in players (guests count): nothing can be called without a session
do $$ declare f text; begin
  foreach f in array array['ci_buy_goods(uuid, text, int)', 'ci_sell_goods(uuid, text, int, text)', 'ci_take_contract(uuid, text)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
