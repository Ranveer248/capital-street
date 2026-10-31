-- Capital Street Goal 31: safer multiplayer. Additive: no table or row is dropped, and older games keep working.
--   1. Cloud saves can't be overwritten by an older copy: a save names the version it was based on, and the server
--      refuses it if a newer one arrived since (another device or tab).
--   2. Money between players is a ledger (cs_inbox) applied exactly once: a game reads its open rows, applies them,
--      lists their ids in its save, uploads the save, and only then marks them done (cs_inbox_ack). A refresh or a
--      dropped connection in between can't lose them or count them twice.
--   3. Buying from a player and bidding are checked against the cash the server knows you have: your last uploaded
--      save plus ledger rows it doesn't include yet. A purchase is written to the ledger for both sides at once.
--   Cash still starts in each player's own save (see schema.sql); this stops double spending, races and replays.

-- 1. versioned cloud saves
create or replace function public.cs_put_save(p_data jsonb, p_base timestamptz)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); cur timestamptz; out_at timestamptz;
begin
  if me is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from public.cs_players where id = me) then raise exception 'Pick a player name first'; end if;
  if octet_length(p_data::text) > 3000000 then raise exception 'Save too big'; end if;
  select updated_at into cur from public.cs_saves where player = me for update;
  if cur is not null and p_base is distinct from cur then raise exception 'Newer save on your account'; end if;
  insert into public.cs_saves as s (player, data) values (me, p_data)
  on conflict (player) do update set data = excluded.data
  returning updated_at into out_at;
  return out_at;
end $$;

-- 2. the ledger: purchases from players are written for the buyer too, and rows are marked done only after the save
alter table public.cs_inbox drop constraint if exists cs_inbox_kind_check;
alter table public.cs_inbox add constraint cs_inbox_kind_check check (kind in ('sold', 'won', 'bought', 'goods', 'cash', 'note'));
create or replace function public.cs_inbox_ack(p_ids bigint[])
returns int language sql security definer set search_path = '' as $$
  with d as (update public.cs_inbox set collected = true where player = auth.uid() and id = any(p_ids) and not collected returning 1)
  select count(*)::int from d;
$$;

-- 3. what you can spend, as far as the server knows
create or replace function public.cs_cash_free(p_player uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce((s.data #>> '{market,cash}')::numeric, 0)
    + coalesce((select sum(i.cash) from public.cs_inbox i
        where i.player = p_player and not i.collected
          and not (coalesce(s.data #> '{market,ledger}', '[]'::jsonb) @> to_jsonb(i.id))), 0)
  from public.cs_saves s where s.player = p_player;
$$;

create or replace function public.cs_buy_listing(p_city text, p_building text, p_price numeric)
returns public.cs_listings language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); l public.cs_listings; b public.cs_buildings; free numeric;
begin
  if not exists (select 1 from public.cs_players where id = me) then raise exception 'Pick a player name first'; end if;
  select * into l from public.cs_listings where city = p_city and building = p_building for update;
  if l.seller is null then raise exception 'No longer for sale'; end if;
  if l.seller = me then raise exception 'That is your own listing'; end if;
  if l.price <> round(p_price, 2) then raise exception 'The price changed'; end if;
  select * into b from public.cs_buildings where city = p_city and building = p_building for update;
  if b.owner is distinct from l.seller then raise exception 'No longer for sale'; end if;
  free := public.cs_cash_free(me);
  if free is null then raise exception 'Your game hasn''t reached the server yet. Try again in a moment'; end if;
  if free < l.price then raise exception 'You need $% in cash (you have $%)', l.price, round(free, 2); end if;
  update public.cs_buildings set owner = me, bought_at = now() where city = p_city and building = p_building;
  delete from public.cs_listings where city = p_city and building = p_building;
  insert into public.cs_inbox (player, kind, cash, city, building, floors, name, note) values
    (l.seller, 'sold', l.price, p_city, p_building, b.floors, b.name, 'Sold to ' || (select name from public.cs_players where id = me)),
    (me, 'bought', -l.price, p_city, p_building, b.floors, b.name, 'Bought from ' || (select name from public.cs_players where id = l.seller));
  return l;
end $$;

create or replace function public.cs_bid(p_auction bigint, p_max numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid(); a public.cs_pauctions; lead uuid; topmax numeric; secmax numeric; cur numeric; stp numeric; free numeric;
begin
  if not exists (select 1 from public.cs_players where id = me) then raise exception 'Pick a player name first'; end if;
  select * into a from public.cs_pauctions where id = p_auction for update;
  if a.id is null or a.status <> 'open' or a.ends_at <= now() then raise exception 'This auction has ended'; end if;
  if a.seller = me then raise exception 'You can''t bid on your own auction'; end if;
  free := public.cs_cash_free(me);
  if free is null then raise exception 'Your game hasn''t reached the server yet. Try again in a moment'; end if;
  if p_max > free then raise exception 'You can bid up to the cash you have ($%)', round(free, 2); end if;
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

revoke all on function public.cs_put_save(jsonb, timestamptz) from public, anon;
revoke all on function public.cs_inbox_ack(bigint[]) from public, anon;
revoke all on function public.cs_cash_free(uuid) from public, anon, authenticated;
grant execute on function public.cs_put_save(jsonb, timestamptz) to authenticated;
grant execute on function public.cs_inbox_ack(bigint[]) to authenticated;
