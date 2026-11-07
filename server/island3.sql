-- Capital Island server upgrade 3 (Goal 40): plots, resources, business shifts, island traders and the auction house, online.
-- It only ADDS: new tables and new functions. No existing table, row or function is changed, so the game keeps working
-- against it. Safe to run more than once. Undo: island3-undo.sql.
--   - plots: the 35 pieces of ground the island has (ci_plot_sites, the same list the game draws), who owns each (ci_plots)
--     and what stands on it; income is worked out here from timestamps, so it cannot be forged
--   - resources (stone, coal, oil, goods) per player (ci_res); farms fill the co-op store (ci_stock 'farm') like grown crates
--   - business shifts and island trader deals have cool-downs (ci_cd)
--   - the auction house (ci_auctions): resources or a whole plot, with a reserve and an optional buy-now price; the item and
--     the bids are held by the server until it ends; an island trader buys anything nobody bid on if the reserve is fair
-- The rules are the same as island/sample/app.js (plots block); prices: stone 14, coal 22, oil 38, goods 95 with a slow wobble.

-- ---------- tables ----------
create table if not exists public.ci_plot_sites (
  id text primary key, kind text not null, area text not null, price numeric(12, 2) not null check (price > 0),
  old boolean not null default false, res text
);
create table if not exists public.ci_plots (
  id text primary key references public.ci_plot_sites (id),
  owner uuid not null references public.ci_players (id) on delete cascade,
  cleared boolean not null default false, b jsonb, t timestamptz not null default now(), listed boolean not null default false,
  bought_at timestamptz not null default now()
);
create table if not exists public.ci_res (
  player uuid not null references public.ci_players (id) on delete cascade,
  res text not null check (res in ('stone', 'coal', 'oil', 'goods')), qty int not null default 0 check (qty >= 0),
  primary key (player, res)
);
create table if not exists public.ci_cd (
  player uuid not null references public.ci_players (id) on delete cascade, k text not null, until timestamptz not null,
  primary key (player, k)
);
create table if not exists public.ci_auctions (
  id uuid primary key default gen_random_uuid(),
  seller uuid not null references public.ci_players (id) on delete cascade, seller_name text not null,
  item text not null check (item in ('stone', 'coal', 'oil', 'goods', 'plot')), qty int not null default 1 check (qty > 0),
  plot text references public.ci_plot_sites (id),
  reserve numeric(12, 2) not null check (reserve >= 1), buyout numeric(12, 2), bid numeric(12, 2),
  bidder uuid references public.ci_players (id) on delete set null, bidder_name text,
  ends_at timestamptz not null, status text not null default 'open' check (status in ('open', 'sold', 'unsold', 'cancelled')),
  closed_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists ci_auctions_open on public.ci_auctions (status, ends_at);
create index if not exists ci_plots_owner on public.ci_plots (owner);
create index if not exists ci_auctions_seller on public.ci_auctions (seller);
create index if not exists ci_auctions_bidder on public.ci_auctions (bidder);
create index if not exists ci_auctions_plot on public.ci_auctions (plot);

-- ---------- who can read what ----------
alter table public.ci_plot_sites enable row level security;
alter table public.ci_plots enable row level security;
alter table public.ci_res enable row level security;
alter table public.ci_cd enable row level security;
alter table public.ci_auctions enable row level security;
drop policy if exists "plot sites are public" on public.ci_plot_sites; create policy "plot sites are public" on public.ci_plot_sites for select using (true);
drop policy if exists "who owns a plot is public" on public.ci_plots; create policy "who owns a plot is public" on public.ci_plots for select using (true);
drop policy if exists "your own resources" on public.ci_res; create policy "your own resources" on public.ci_res for select to authenticated using ((select auth.uid()) = player);
drop policy if exists "your own cool-downs" on public.ci_cd; create policy "your own cool-downs" on public.ci_cd for select to authenticated using ((select auth.uid()) = player);
drop policy if exists "auctions are public" on public.ci_auctions; create policy "auctions are public" on public.ci_auctions for select using (true);
do $$ declare t text; begin
  foreach t in array array['ci_plots', 'ci_auctions'] loop
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- the rules ----------
-- what a resource sells for now, in dollars (the same wobble the game shows)
create or replace function public.ci_res_price(p_res text) returns int language sql stable set search_path = '' as $$
  select round((case p_res when 'stone' then 14 when 'coal' then 22 when 'oil' then 38 else 95 end)
    * (1 + 0.15 * sin(extract(epoch from now()) * 1000 / 45000 + length(p_res) * 2.1)))::int $$;
create or replace function public.ci_bld_cost(k text) returns int language sql immutable set search_path = '' as $$
  select case k when 'house' then 1800 when 'shop' then 2600 when 'office' then 5200 when 'villa' then 6500 when 'farm' then 2200 when 'mine' then 3000
    when 'warehouse' then 3200 when 'factory' then 7500 when 'harbour' then 6800 when 'tower' then 9500 end $$;
create or replace function public.ci_bld_ok(site_kind text, k text) returns boolean language sql immutable set search_path = '' as $$
  select k = any (case site_kind when 'town' then array['house', 'shop', 'office'] when 'villa' then array['villa'] when 'farm' then array['farm']
    when 'stone' then array['mine'] when 'coal' then array['mine'] when 'oil' then array['mine'] when 'industrial' then array['warehouse', 'factory']
    when 'harbour' then array['harbour'] when 'tower' then array['tower', 'office'] else array[]::text[] end) $$;
-- income per game hour (two real minutes), and units made per game hour
create or replace function public.ci_plot_rate(b jsonb) returns numeric language sql immutable set search_path = '' as $$
  select case when b->>'kind' = 'tower' then 700 * (array[1, 1.9, 3.2])[least(3, greatest(1, coalesce((b->>'tier')::int, 1)))]
    else coalesce(case b->>'kind' when 'house' then 180 when 'villa' then 420 when 'shop' then 170 when 'office' then 260 when 'warehouse' then 150
      when 'harbour' then 320 end, 0) * coalesce((b->>'tier')::int, 1) end $$;
create or replace function public.ci_plot_yield(b jsonb) returns int language sql immutable set search_path = '' as $$
  select (case b->>'kind' when 'mine' then case b->>'res' when 'coal' then 12 when 'oil' then 10 else 16 end when 'farm' then 14 when 'factory' then 6 else 0 end)
    * coalesce((b->>'tier')::int, 1) $$;
create or replace function public.ci_owns(u uuid, kinds text[]) returns boolean language sql stable set search_path = '' as $$
  select exists (select 1 from public.ci_plots where owner = u and b->>'kind' = any (kinds)) $$;

-- collect what a plot has made since it was last emptied (inside the functions below only)
create or replace function public.ci_plot_take(u uuid, p_id text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare p public.ci_plots; bb jsonb; k text; h numeric; n int := 0; c numeric := 0; st numeric; rs int; rc int; ro int; what text := ''; area text;
begin
  select * into p from public.ci_plots where id = p_id and owner = u for update;
  if not found or p.b is null then return jsonb_build_object('cash', 0, 'units', 0); end if;
  bb := p.b; k := bb->>'kind'; h := least(8, greatest(0, extract(epoch from (now() - p.t)) / 120));
  select s.area into area from public.ci_plot_sites s where s.id = p_id;
  if k = 'farm' then
    n := floor(public.ci_plot_yield(bb) * h); what := 'crates';
    if n > 0 then insert into public.ci_stock as x (player, site, qty, cost) values (u, 'farm', n, n * 4)
      on conflict (player, site) do update set qty = x.qty + excluded.qty, cost = x.cost + excluded.cost; end if;
  elsif k = 'mine' then
    n := floor(public.ci_plot_yield(bb) * h); what := coalesce(bb->>'res', 'stone');
    if n > 0 then insert into public.ci_res as x (player, res, qty) values (u, what, n) on conflict (player, res) do update set qty = x.qty + excluded.qty; end if;
  elsif k = 'factory' then
    select coalesce(max(qty) filter (where res = 'stone'), 0), coalesce(max(qty) filter (where res = 'coal'), 0), coalesce(max(qty) filter (where res = 'oil'), 0)
      into rs, rc, ro from public.ci_res where player = u;
    n := greatest(0, least(floor(public.ci_plot_yield(bb) * h)::int, rs / 2, rc, ro)); what := 'goods';
    if n > 0 then
      update public.ci_res set qty = qty - case res when 'stone' then 2 * n else n end where player = u and res in ('stone', 'coal', 'oil');
      insert into public.ci_res as x (player, res, qty) values (u, 'goods', n) on conflict (player, res) do update set qty = x.qty + excluded.qty;
    end if;
  elsif k = 'shop' then
    st := coalesce((bb->>'stock')::numeric, 0); h := least(h, st / 25); c := floor(public.ci_plot_rate(bb) * h);
    bb := jsonb_set(bb, '{stock}', to_jsonb(round(greatest(0, st - 25 * h))));
  elsif k in ('house', 'villa') then
    if coalesce(bb->>'rent', 'true') <> 'false' then c := floor(public.ci_plot_rate(bb) * h); end if;
  else
    c := floor(public.ci_plot_rate(bb) * h);
  end if;
  if c > 0 then
    perform public.ci_note(initcap(k) || case when k = 'shop' then ' sales' else ' rent' end || ' at ' || coalesce(nullif(bb->>'name', ''), area));
    update public.ci_players set cash = cash + c where id = u;
  end if;
  update public.ci_plots set t = now(), b = bb where id = p_id;
  return jsonb_build_object('cash', c, 'units', n, 'what', what);
end $$;

-- one plot action: buy, sell, clear (pull down the old house), build, upgrade, demolish, collect, rent (toggle), restock, look
create or replace function public.ci_plot(p_id text, p_act text, p_arg jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); s public.ci_plot_sites; p public.ci_plots; bb jsonb; cost numeric; k text; nm text; col bigint; roof bigint;
begin
  perform 1 from public.ci_players where id = u for update;
  select * into s from public.ci_plot_sites where id = p_id; if not found then raise exception 'No such plot'; end if;
  select * into p from public.ci_plots where id = p_id for update;
  if p_act = 'buy' then
    if p.id is not null then raise exception 'Someone already owns this plot'; end if;
    perform public.ci_note('Bought a plot in ' || s.area);
    update public.ci_players set cash = cash - s.price where id = u and cash >= s.price;
    if not found then perform public.ci_note(''); raise exception 'Not enough cash'; end if;
    insert into public.ci_plots (id, owner) values (p_id, u);
    return public.ci_plots_state();
  end if;
  if p.id is null or p.owner <> u then raise exception 'This plot is not yours'; end if;
  if p.listed then raise exception 'This plot is in the auction house'; end if;
  bb := p.b;
  if p_act = 'sell' then
    perform public.ci_plot_take(u, p_id);
    perform public.ci_note('Sold a plot in ' || s.area); update public.ci_players set cash = cash + round(s.price * 0.6) where id = u;
    delete from public.ci_plots where id = p_id;
  elsif p_act = 'clear' then
    if not s.old or p.cleared or bb is not null then raise exception 'There is nothing to pull down'; end if;
    perform public.ci_note('Cleared the old house in ' || s.area);
    update public.ci_players set cash = cash - 300 where id = u and cash >= 300; if not found then perform public.ci_note(''); raise exception 'Not enough cash'; end if;
    update public.ci_plots set cleared = true where id = p_id;
  elsif p_act = 'build' then
    k := p_arg->>'kind';
    if bb is not null then raise exception 'Something is already built here'; end if;
    if s.old and not p.cleared then raise exception 'Pull the old house down first'; end if;
    if k is null or not public.ci_bld_ok(s.kind, k) then raise exception 'That can''t be built here'; end if;
    cost := public.ci_bld_cost(k);
    col := least(16777215, greatest(0, coalesce((p_arg->>'color')::bigint, 15853264))); roof := least(16777215, greatest(0, coalesce((p_arg->>'roof')::bigint, 11818285)));
    perform public.ci_note('Built a ' || k || ' in ' || s.area);
    update public.ci_players set cash = cash - cost where id = u and cash >= cost; if not found then perform public.ci_note(''); raise exception 'Not enough cash'; end if;
    update public.ci_plots set t = now(), b = jsonb_build_object('kind', k, 'tier', 1, 'color', col, 'roof', roof, 'style', 'modern', 'name', '',
      'res', s.res, 'stock', 100, 'rent', true, 'invest', cost) where id = p_id;
  elsif bb is null then raise exception 'Nothing is built here yet';
  elsif p_act = 'upgrade' then
    if coalesce((bb->>'tier')::int, 1) >= 3 then raise exception 'It is already at the top level'; end if;
    cost := round(public.ci_bld_cost(bb->>'kind') * 0.8 * coalesce((bb->>'tier')::int, 1));
    perform public.ci_plot_take(u, p_id); select b into bb from public.ci_plots where id = p_id;
    perform public.ci_note('Renovated in ' || s.area);
    update public.ci_players set cash = cash - cost where id = u and cash >= cost; if not found then perform public.ci_note(''); raise exception 'Not enough cash'; end if;
    update public.ci_plots set b = bb || jsonb_build_object('tier', coalesce((bb->>'tier')::int, 1) + 1, 'invest', coalesce((bb->>'invest')::numeric, 0) + cost) where id = p_id;
  elsif p_act = 'demolish' then
    perform public.ci_plot_take(u, p_id);
    cost := round(coalesce((bb->>'invest')::numeric, 0) * 0.25);
    if cost > 0 then perform public.ci_note('Demolished in ' || s.area); update public.ci_players set cash = cash + cost where id = u; end if;
    update public.ci_plots set b = null, cleared = true where id = p_id;
  elsif p_act = 'collect' then
    perform public.ci_plot_take(u, p_id);
  elsif p_act = 'rent' then
    if bb->>'kind' not in ('house', 'villa') then raise exception 'Only homes are rented out'; end if;
    perform public.ci_plot_take(u, p_id);
    update public.ci_plots set b = jsonb_set(b, '{rent}', to_jsonb(coalesce(b->>'rent', 'true') = 'false')) where id = p_id;
  elsif p_act = 'restock' then
    if bb->>'kind' <> 'shop' then raise exception 'Only shops have shelves'; end if;
    perform public.ci_plot_take(u, p_id);
    perform public.ci_note('Restocked the shop'); update public.ci_players set cash = cash - 60 where id = u and cash >= 60;
    if not found then perform public.ci_note(''); raise exception 'Not enough cash'; end if;
    update public.ci_plots set b = jsonb_set(b, '{stock}', '100'::jsonb) where id = p_id;
  elsif p_act = 'look' then
    if p_arg ? 'color' then bb := jsonb_set(bb, '{color}', to_jsonb(least(16777215, greatest(0, (p_arg->>'color')::bigint)))); end if;
    if p_arg ? 'roof' then bb := jsonb_set(bb, '{roof}', to_jsonb(least(16777215, greatest(0, (p_arg->>'roof')::bigint)))); end if;
    if p_arg->>'style' in ('modern', 'cosy', 'luxury') then bb := jsonb_set(bb, '{style}', to_jsonb(p_arg->>'style')); end if;
    if p_arg ? 'name' then nm := left(trim(regexp_replace(coalesce(p_arg->>'name', ''), '[^A-Za-z0-9 .&''-]', '', 'g')), 18); bb := jsonb_set(bb, '{name}', to_jsonb(nm)); end if;
    update public.ci_plots set b = bb where id = p_id;
  else raise exception 'Unknown plot action';
  end if;
  return public.ci_plots_state();
end $$;

create or replace function public.ci_plots_collect() returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); r record;
begin
  perform 1 from public.ci_players where id = u for update;
  for r in select id from public.ci_plots where owner = u and b is not null and not listed order by id loop perform public.ci_plot_take(u, r.id); end loop;
  return public.ci_plots_state();
end $$;

-- a business shift: needs a mine, farm, shop or harbour of your own
create or replace function public.ci_biz(p_kind text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); bb jsonb; n int; c numeric; rk text;
begin
  perform 1 from public.ci_players where id = u for update;
  if p_kind not in ('mine', 'farm', 'shop', 'harbour') then raise exception 'Unknown job'; end if;
  select b into bb from public.ci_plots where owner = u and b->>'kind' = p_kind order by bought_at, id limit 1;
  if bb is null then raise exception 'You need a % on one of your plots', p_kind; end if;
  if exists (select 1 from public.ci_cd where player = u and k = 'biz:' || p_kind and until > now()) then raise exception 'Not ready yet'; end if;
  if p_kind = 'mine' then
    n := round(public.ci_plot_yield(bb) * 1.5); rk := coalesce(bb->>'res', 'stone');
    insert into public.ci_res as x (player, res, qty) values (u, rk, n) on conflict (player, res) do update set qty = x.qty + excluded.qty;
  elsif p_kind = 'farm' then
    n := public.ci_plot_yield(bb);
    insert into public.ci_stock as x (player, site, qty, cost) values (u, 'farm', n, n * 4) on conflict (player, site) do update set qty = x.qty + excluded.qty, cost = x.cost + excluded.cost;
  else
    c := round(public.ci_plot_rate(bb) * case when p_kind = 'shop' then 0.6 else 1.2 end);
    perform public.ci_note(case when p_kind = 'shop' then 'Counter shift' else 'Freight run' end); update public.ci_players set cash = cash + c where id = u;
  end if;
  insert into public.ci_cd as x (player, k, until) values (u, 'biz:' || p_kind, now() + case when p_kind = 'harbour' then interval '120 seconds' else interval '75 seconds' end)
    on conflict (player, k) do update set until = excluded.until;
  update public.ci_players set xp = xp + 4 where id = u;
  return public.ci_plots_state();
end $$;

-- sell all of one resource to the island's buyers: needs an office or a tower; a harbour adds 35%
create or replace function public.ci_res_sell(p_res text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); n int; unit int; total numeric;
begin
  perform 1 from public.ci_players where id = u for update;
  if not public.ci_owns(u, array['office', 'tower']) then raise exception 'You need an Office or a Tower to trade'; end if;
  select qty into n from public.ci_res where player = u and res = p_res for update;
  if coalesce(n, 0) < 1 then raise exception 'You have none to sell'; end if;
  unit := round(public.ci_res_price(p_res) * case when public.ci_owns(u, array['harbour']) then 1.35 else 1 end); total := n * unit;
  update public.ci_res set qty = 0 where player = u and res = p_res;
  perform public.ci_note('Sold ' || n || ' ' || p_res); update public.ci_players set cash = cash + total where id = u;
  return public.ci_plots_state();
end $$;

-- island traders (the computer): three offers every five minutes, worked out from the clock alone (the game does the same sums)
create or replace function public.ci_ai_offer(p_slot bigint, p_n int) returns jsonb language sql immutable set search_path = '' as $$
  with v as (select (array['stone', 'coal', 'oil', 'goods'])[((p_slot * 7 + p_n * 3) % 4) + 1] as res, case when (p_slot + p_n) % 2 = 0 then 'buy' else 'sell' end as side)
  select jsonb_build_object('n', p_n, 'res', v.res, 'side', v.side,
    'qty', case when v.res = 'goods' then 4 + ((p_slot * 13 + p_n * 29) % 5) * 2 else 10 + ((p_slot * 13 + p_n * 29) % 5) * 5 end,
    'unit', round((case v.res when 'stone' then 14 when 'coal' then 22 when 'oil' then 38 else 95 end)
      * (case when v.side = 'buy' then 112 + (p_slot * 17 + p_n * 11) % 19 else 75 + (p_slot * 17 + p_n * 11) % 16 end) / 100.0),
    'name', (array['Auntie Priya', 'Lee & Sons', 'Coral Supply', 'Dodo Hardware', 'Mr Bertrand', 'Harbour Mart', 'Island Build Co', 'Green Bay Traders'])[((p_slot * 5 + p_n * 7) % 8) + 1])
  from v $$;
create or replace function public.ci_ai_deal(p_n int) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); slot bigint := floor(extract(epoch from now()) / 300); o jsonb; q int; total numeric; have int;
begin
  perform 1 from public.ci_players where id = u for update;
  if p_n not in (0, 1, 2) then raise exception 'No such offer'; end if;
  if not public.ci_owns(u, array['office', 'tower']) then raise exception 'You need an Office or a Tower to trade'; end if;
  if exists (select 1 from public.ci_cd where player = u and k = 'ai:' || p_n and until > now()) then raise exception 'You already took this offer'; end if;
  o := public.ci_ai_offer(slot, p_n); q := (o->>'qty')::int; total := q * (o->>'unit')::numeric;
  if o->>'side' = 'buy' then -- the trader buys from you
    select qty into have from public.ci_res where player = u and res = o->>'res' for update;
    if coalesce(have, 0) < q then raise exception 'You need % %', q, o->>'res'; end if;
    update public.ci_res set qty = qty - q where player = u and res = o->>'res';
    perform public.ci_note('Sold ' || q || ' ' || (o->>'res') || ' to ' || (o->>'name')); update public.ci_players set cash = cash + total where id = u;
  else -- the trader sells to you
    perform public.ci_note('Bought ' || q || ' ' || (o->>'res') || ' from ' || (o->>'name'));
    update public.ci_players set cash = cash - total where id = u and cash >= total; if not found then perform public.ci_note(''); raise exception 'Not enough cash'; end if;
    insert into public.ci_res as x (player, res, qty) values (u, o->>'res', q) on conflict (player, res) do update set qty = x.qty + excluded.qty;
  end if;
  insert into public.ci_cd as x (player, k, until) values (u, 'ai:' || p_n, to_timestamp((slot + 1) * 300)) on conflict (player, k) do update set until = excluded.until;
  update public.ci_players set xp = xp + 2 where id = u;
  return public.ci_plots_state();
end $$;

-- ---------- the auction house ----------
-- what an island trader would pay for an auction nobody bid on
create or replace function public.ci_auction_fair(a public.ci_auctions) returns numeric language sql stable set search_path = '' as $$
  select case when a.item = 'plot' then (select s.price + coalesce((p.b->>'invest')::numeric, 0) * 0.7 from public.ci_plot_sites s left join public.ci_plots p on p.id = s.id where s.id = a.plot)
    else a.qty * public.ci_res_price(a.item) end $$;
-- end one auction: the winner gets the item, the seller the money less 5%; nobody bid: a trader buys it if the reserve is fair
-- (paying 98% of the fair price, at least the reserve and at most the buy-now price), else it goes back
create or replace function public.ci_auction_close(p_id uuid) returns void language plpgsql security definer set search_path = '' as $$
declare a public.ci_auctions; what text; fair numeric; pay numeric;
begin
  select * into a from public.ci_auctions where id = p_id and status = 'open' for update; if not found then return; end if;
  what := case when a.item = 'plot' then 'a plot' else a.qty || ' ' || a.item end;
  fair := public.ci_auction_fair(a); pay := greatest(a.reserve, least(coalesce(a.buyout, 1e12), round(fair * 0.98)));
  if a.bidder is not null and a.bid is not null then
    if a.item = 'plot' then update public.ci_plots set owner = a.bidder, listed = false, t = now(), bought_at = now() where id = a.plot;
    else insert into public.ci_res as x (player, res, qty) values (a.bidder, a.item, a.qty) on conflict (player, res) do update set qty = x.qty + excluded.qty; end if;
    perform public.ci_note('Auction: sold ' || what || ' to ' || coalesce(a.bidder_name, 'a player')); update public.ci_players set cash = cash + round(a.bid * 0.95, 2) where id = a.seller;
    update public.ci_auctions set status = 'sold', closed_at = now() where id = p_id;
  elsif a.reserve <= fair * 1.05 then
    if a.item = 'plot' then delete from public.ci_plots where id = a.plot; end if; -- the trader puts the ground back on the market
    perform public.ci_note('Auction: sold ' || what || ' to an island trader'); update public.ci_players set cash = cash + round(pay * 0.95, 2) where id = a.seller;
    update public.ci_auctions set status = 'sold', bid = pay, bidder_name = 'Island trader', closed_at = now() where id = p_id;
  else
    if a.item = 'plot' then update public.ci_plots set listed = false where id = a.plot;
    else insert into public.ci_res as x (player, res, qty) values (a.seller, a.item, a.qty) on conflict (player, res) do update set qty = x.qty + excluded.qty; end if;
    update public.ci_auctions set status = 'unsold', closed_at = now() where id = p_id;
  end if;
end $$;
create or replace function public.ci_auction_settle() returns void language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  for r in select id from public.ci_auctions where status = 'open' and ends_at <= now() order by ends_at for update skip locked loop perform public.ci_auction_close(r.id); end loop;
end $$;
create or replace function public.ci_auction_new(p_item text, p_qty int, p_plot text, p_reserve numeric, p_buyout numeric, p_minutes int) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); nm text; have int;
begin
  perform 1 from public.ci_players where id = u for update;
  if p_minutes not in (5, 15, 60) then raise exception 'Pick 5, 15 or 60 minutes'; end if;
  if p_reserve is null or p_reserve < 1 or p_reserve > 10000000 then raise exception 'Set a starting price'; end if;
  if p_buyout is not null and p_buyout < p_reserve then raise exception 'Buy now must be at least the starting price'; end if;
  if (select count(*) from public.ci_auctions where seller = u and status = 'open') >= 5 then raise exception 'You can have 5 auctions at a time'; end if;
  if p_item = 'plot' then
    perform 1 from public.ci_plots where id = p_plot and owner = u and not listed for update; if not found then raise exception 'That plot is not yours to sell'; end if;
    perform public.ci_plot_take(u, p_plot); update public.ci_plots set listed = true where id = p_plot; p_qty := 1;
  elsif p_item in ('stone', 'coal', 'oil', 'goods') then
    if p_qty is null or p_qty < 1 or p_qty > 9999 then raise exception 'Pick how many'; end if;
    select qty into have from public.ci_res where player = u and res = p_item for update;
    if coalesce(have, 0) < p_qty then raise exception 'You don''t have that many'; end if;
    update public.ci_res set qty = qty - p_qty where player = u and res = p_item; p_plot := null;
  else raise exception 'That can''t be auctioned'; end if;
  select name into nm from public.ci_players where id = u;
  insert into public.ci_auctions (seller, seller_name, item, qty, plot, reserve, buyout, ends_at)
    values (u, nm, p_item, p_qty, p_plot, round(p_reserve, 2), round(p_buyout, 2), now() + make_interval(mins => p_minutes));
  return public.ci_plots_state();
end $$;
-- bid: the money is held until you are outbid (then it comes back) or the auction ends; a late bid adds 30 seconds
create or replace function public.ci_auction_bid(p_id uuid, p_amount numeric) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); a public.ci_auctions; low numeric; nm text; buy boolean;
begin
  perform public.ci_auction_settle();
  select * into a from public.ci_auctions where id = p_id for update;
  if not found or a.status <> 'open' or a.ends_at <= now() then raise exception 'This auction has ended'; end if;
  if a.seller = u then raise exception 'You can''t bid on your own auction'; end if;
  if a.bidder = u then raise exception 'You already have the top bid'; end if;
  low := case when a.bid is null then a.reserve else greatest(a.bid + 1, ceil(a.bid * 1.05)) end;
  buy := a.buyout is not null and p_amount >= a.buyout; if buy then p_amount := a.buyout; end if;
  if p_amount is null or p_amount < low then raise exception 'Bid at least $%', rtrim(to_char(low, 'FM9999999990.99'), '.'); end if;
  perform 1 from public.ci_players where id in (u, coalesce(a.bidder, u)) order by id for update;
  select name into nm from public.ci_players where id = u;
  perform public.ci_note('Bid in the auction house'); update public.ci_players set cash = cash - p_amount where id = u and cash >= p_amount;
  if not found then perform public.ci_note(''); raise exception 'Not enough cash'; end if;
  if a.bidder is not null then perform public.ci_note('Outbid: your bid came back'); update public.ci_players set cash = cash + a.bid where id = a.bidder; end if;
  update public.ci_auctions set bid = round(p_amount, 2), bidder = u, bidder_name = nm, ends_at = greatest(ends_at, now() + interval '30 seconds') where id = p_id;
  if buy then perform public.ci_auction_close(p_id); end if;
  return public.ci_plots_state();
end $$;
create or replace function public.ci_auction_cancel(p_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); a public.ci_auctions;
begin
  select * into a from public.ci_auctions where id = p_id and seller = u and status = 'open' for update; if not found then raise exception 'Nothing to cancel'; end if;
  if a.bidder is not null then raise exception 'Someone has bid: it has to run to the end'; end if;
  if a.item = 'plot' then update public.ci_plots set listed = false where id = a.plot;
  else insert into public.ci_res as x (player, res, qty) values (u, a.item, a.qty) on conflict (player, res) do update set qty = x.qty + excluded.qty; end if;
  update public.ci_auctions set status = 'cancelled', closed_at = now() where id = p_id;
  return public.ci_plots_state();
end $$;

-- everything the plots, resources and auctions screens show
create or replace function public.ci_plots_state() returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); slot bigint := floor(extract(epoch from now()) / 300);
begin
  perform public.ci_auction_settle();
  return jsonb_build_object('now', now(), 'slot', slot,
    'plots', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'owner', p.owner, 'name', pl.name, 'cleared', p.cleared, 'b', p.b, 't', p.t, 'listed', p.listed) order by p.bought_at, p.id)
      from public.ci_plots p join public.ci_players pl on pl.id = p.owner), '[]'::jsonb),
    'res', coalesce((select jsonb_object_agg(res, qty) from public.ci_res where player = u), '{}'::jsonb),
    'cd', coalesce((select jsonb_object_agg(k, until) from public.ci_cd where player = u and until > now()), '{}'::jsonb),
    'ai', jsonb_build_array(public.ci_ai_offer(slot, 0), public.ci_ai_offer(slot, 1), public.ci_ai_offer(slot, 2)),
    'auctions', coalesce((select jsonb_agg(to_jsonb(x) - 'seller' - 'bidder' || jsonb_build_object('mine', x.seller = u, 'top', x.bidder = u) order by x.status <> 'open', x.ends_at)
      from (select * from public.ci_auctions where status = 'open' or ((seller = u or bidder = u) and closed_at > now() - interval '2 hours') order by created_at desc limit 60) x), '[]'::jsonb));
end $$;

-- the helpers only run inside the functions above; the game's own functions are for signed-in players (guests count)
revoke execute on function public.ci_plot_take(uuid, text) from public, anon, authenticated;
revoke execute on function public.ci_auction_close(uuid) from public, anon, authenticated;
revoke execute on function public.ci_auction_settle() from public, anon, authenticated;
revoke execute on function public.ci_owns(uuid, text[]) from public, anon, authenticated;
do $$ declare f text; begin
  foreach f in array array['ci_plot(text, text, jsonb)', 'ci_plots_collect()', 'ci_biz(text)', 'ci_res_sell(text)', 'ci_ai_deal(int)',
    'ci_auction_new(text, int, text, numeric, numeric, int)', 'ci_auction_bid(uuid, numeric)', 'ci_auction_cancel(uuid)', 'ci_plots_state()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ---------- the island's plots (the same list the game draws: island/sample/expand.js, plots()) ----------
insert into public.ci_plot_sites (id, kind, area, price, old, res) values
  ('pl0', 'town', 'Millford', 1260, false, null),
  ('pl1', 'town', 'Millford', 1480, false, null),
  ('pl2', 'town', 'Millford', 1410, false, null),
  ('pl3', 'town', 'Northhaven', 1340, true, null),
  ('pl4', 'town', 'Northhaven', 1270, true, null),
  ('pl5', 'town', 'Northhaven', 1500, true, null),
  ('pl6', 'town', 'Eastgate', 1430, false, null),
  ('pl7', 'town', 'Eastgate', 1360, true, null),
  ('pl8', 'town', 'Eastgate', 1290, true, null),
  ('pl9', 'town', 'Eastgate', 1510, false, null),
  ('pl10', 'town', 'Eastgate', 1440, false, null),
  ('pl11', 'farm', 'Greenfields plain', 980, false, null),
  ('pl12', 'farm', 'Greenfields plain', 930, false, null),
  ('pl13', 'farm', 'Greenfields plain', 1090, false, null),
  ('pl14', 'stone', 'Redstone Quarry', 1660, false, 'stone'),
  ('pl15', 'stone', 'Redstone Quarry', 1580, false, 'stone'),
  ('pl16', 'stone', 'Redstone Quarry', 1500, true, 'stone'),
  ('pl17', 'coal', 'Deepwell Mine', 1980, true, 'coal'),
  ('pl18', 'coal', 'Deepwell Mine', 1890, false, 'coal'),
  ('pl19', 'coal', 'Deepwell Mine', 1800, false, 'coal'),
  ('pl20', 'oil', 'Southern oil field', 2090, false, 'oil'),
  ('pl21', 'oil', 'Southern oil field', 1980, false, 'oil'),
  ('pl22', 'oil', 'Southern oil field', 2330, false, 'oil'),
  ('pl23', 'villa', 'Luxury coast', 3840, false, null),
  ('pl24', 'villa', 'Coral Coast', 3650, true, null),
  ('pl25', 'industrial', 'Works Estate', 2180, false, null),
  ('pl26', 'industrial', 'Works Estate', 2570, false, null),
  ('pl27', 'industrial', 'Works Estate', 2450, false, null),
  ('pl28', 'industrial', 'Works Estate', 2330, false, null),
  ('pl29', 'industrial', 'Works Estate', 2210, false, null),
  ('pl30', 'tower', 'Capital', 4540, false, null),
  ('pl31', 'tower', 'Capital', 4330, false, null),
  ('pl32', 'tower', 'Capital', 4120, false, null),
  ('pl33', 'tower', 'Capital', 3910, false, null),
  ('pl34', 'tower', 'Capital', 4580, false, null),
  ('pl35', 'harbour', 'Eastgate docks', 3740, false, null),
  ('pl36', 'harbour', 'Works quay', 3560, true, null),
  ('pl37', 'harbour', 'South quay', 3380, true, null)
on conflict (id) do update set kind = excluded.kind, area = excluded.area, price = excluded.price, old = excluded.old, res = excluded.res;
