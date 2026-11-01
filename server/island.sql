-- Capital Island economy (Goal 33): the island's players, their stores, timed jobs, shipments, the buyers everyone
-- shares, property, and a market between players. Everything is prefixed ci_, so it sits beside the live game's cs_
-- tables without touching them. Players can read what the game needs to show and write nothing directly: every change
-- to cash, stock, ownership and shipments goes through the functions below, which check the rules on the server.
--   - one booking at a time per player (their row is locked), and per buyer (so shared demand can't be oversold)
--   - bookings carry an id the game makes up, so a retry after a dropped connection books once, not twice
--   - a delivery pays once: only a trip that is still travelling can be delivered, and not faster than a vehicle drives
--   - a building has one owner (primary key); a market offer has one buyer (its row is locked while it is bought)
-- Safe to run more than once.

-- ---------- tables ----------
create table if not exists public.ci_players (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (name ~ '^[A-Za-z0-9][A-Za-z0-9 _.-]{1,18}[A-Za-z0-9]$'),
  color text not null default '#4c8dff' check (color ~ '^#[0-9a-fA-F]{6}$'),
  cash numeric(14, 2) not null default 2340 check (cash >= 0),
  xp int not null default 0 check (xp >= 0),
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create unique index if not exists ci_players_name on public.ci_players (lower(name));

create table if not exists public.ci_stock (
  player uuid not null references public.ci_players (id) on delete cascade,
  site text not null check (site in ('farm', 'plant_in', 'plant_out')),
  qty int not null default 0 check (qty >= 0),
  cost numeric(14, 2) not null default 0 check (cost >= 0),
  primary key (player, site)
);

create table if not exists public.ci_jobs (
  id bigint generated always as identity primary key,
  player uuid not null references public.ci_players (id) on delete cascade,
  kind text not null check (kind in ('grow', 'process')),
  qty int not null check (qty between 1 and 200),
  cost numeric(14, 2) not null check (cost >= 0),
  ends_at timestamptz not null,
  done boolean not null default false
);
create index if not exists ci_jobs_open on public.ci_jobs (player) where not done;

create table if not exists public.ci_routes (
  from_node text not null, to_node text not null, meters numeric not null check (meters > 0),
  primary key (from_node, to_node)
);

create table if not exists public.ci_buyers (
  buyer text primary key, name text not null,
  demand numeric not null, max_demand numeric not null, refill_s numeric not null, base_price numeric not null,
  min_level int not null default 0, updated_at timestamptz not null default now()
);

create table if not exists public.ci_shipments (
  id uuid primary key, -- made by the game, so a retried booking is recognised
  player uuid not null references public.ci_players (id) on delete cascade,
  kind text not null check (kind in ('crop', 'food')),
  from_node text not null, to_node text not null, buyer text references public.ci_buyers (buyer),
  qty int not null check (qty between 1 and 40),
  vehicle text not null check (vehicle in ('truck', 'van')),
  fee numeric(14, 2) not null, price numeric(10, 2), basis numeric(14, 2) not null,
  status text not null check (status in ('queued', 'travelling', 'delivered')),
  created_at timestamptz not null default now(), depart_at timestamptz, delivered_at timestamptz
);
create index if not exists ci_shipments_player on public.ci_shipments (player, status);

create table if not exists public.ci_lots (
  lot text primary key check (char_length(lot) between 3 and 40), -- the building's type and position, e.g. 'villa@-385,109'
  name text not null, price numeric(14, 2) not null check (price > 0), area text not null
);

create table if not exists public.ci_property (
  lot text primary key references public.ci_lots (lot), -- one owner per building
  owner uuid not null references public.ci_players (id) on delete cascade,
  price numeric(14, 2) not null, bought_at timestamptz not null default now()
);
alter table public.ci_property replica identity full;

create table if not exists public.ci_listings (
  id uuid primary key,
  seller uuid not null references public.ci_players (id) on delete cascade,
  qty int not null check (qty between 1 and 200),
  price numeric(10, 2) not null check (price between 1 and 100), -- per box
  cost numeric(14, 2) not null check (cost >= 0), -- what the boxes cost the seller, held while the offer is open
  status text not null default 'open' check (status in ('open', 'sold', 'cancelled')),
  buyer uuid references public.ci_players (id) on delete set null,
  created_at timestamptz not null default now(), closed_at timestamptz
);
create index if not exists ci_listings_open on public.ci_listings (status, created_at);

-- ---------- who can read what (nobody writes directly) ----------
alter table public.ci_players enable row level security;
alter table public.ci_stock enable row level security;
alter table public.ci_jobs enable row level security;
alter table public.ci_routes enable row level security;
alter table public.ci_buyers enable row level security;
alter table public.ci_shipments enable row level security;
alter table public.ci_lots enable row level security;
alter table public.ci_property enable row level security;
alter table public.ci_listings enable row level security;
drop policy if exists "island players are public" on public.ci_players;
create policy "island players are public" on public.ci_players for select using (true);
drop policy if exists "your own stores" on public.ci_stock;
create policy "your own stores" on public.ci_stock for select to authenticated using ((select auth.uid()) = player);
drop policy if exists "your own jobs" on public.ci_jobs;
create policy "your own jobs" on public.ci_jobs for select to authenticated using ((select auth.uid()) = player);
drop policy if exists "your own shipments" on public.ci_shipments;
create policy "your own shipments" on public.ci_shipments for select to authenticated using ((select auth.uid()) = player);
drop policy if exists "routes are public" on public.ci_routes;
create policy "routes are public" on public.ci_routes for select using (true);
drop policy if exists "buyers are public" on public.ci_buyers;
create policy "buyers are public" on public.ci_buyers for select using (true);
drop policy if exists "lots are public" on public.ci_lots;
create policy "lots are public" on public.ci_lots for select using (true);
drop policy if exists "ownership is public" on public.ci_property;
create policy "ownership is public" on public.ci_property for select using (true);
drop policy if exists "the market is public" on public.ci_listings;
create policy "the market is public" on public.ci_listings for select using (true);

-- live updates for what everyone shares
do $$ declare t text; begin
  foreach t in array array['ci_buyers', 'ci_property', 'ci_listings', 'ci_players'] loop
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- the island's fixed data ----------
insert into public.ci_routes (from_node, to_node, meters) values ('FA', 'P', 867), ('P', 'C', 612), ('P', 'J', 767)
on conflict (from_node, to_node) do update set meters = excluded.meters;
insert into public.ci_buyers (buyer, name, demand, max_demand, refill_s, base_price, min_level) values
  ('shops', 'Old Quarter shops', 60, 60, 5, 16, 0),
  ('hotel', 'Hotel Azure', 40, 40, 7, 21, 2)
on conflict (buyer) do update set name = excluded.name, max_demand = excluded.max_demand, refill_s = excluded.refill_s, base_price = excluded.base_price, min_level = excluded.min_level;
insert into public.ci_lots (lot, name, price, area) values
  ('shophouse@-41,42', 'Bakery, Beach Road', 7780, 'Old Quarter'),
  ('shophouse@-20,42', 'Café, Beach Road', 7340, 'Old Quarter'),
  ('shophouse@0,42', 'Grocer, Beach Road', 6910, 'Old Quarter'),
  ('shophouse@20,42', 'Pharmacy, Beach Road', 6910, 'Old Quarter'),
  ('shophouse@41,42', 'Flowers, Beach Road', 7780, 'Old Quarter'),
  ('flat@-47,8', '26 Hotel Street', 6910, 'Old Quarter'),
  ('flat@-47,-20', '40 Hotel Street', 6910, 'Old Quarter'),
  ('flat@-47,-48', '54 Hotel Street', 6910, 'Old Quarter'),
  ('flat@47,8', '16 Market Street', 6910, 'Old Quarter'),
  ('flat@47,-48', '44 Market Street', 6910, 'Old Quarter'),
  ('flat@-38,-96', '38 High Street', 6480, 'Old Quarter'),
  ('flat@-13,-96', '13 High Street', 6480, 'Old Quarter'),
  ('flat@13,-96', '13 High Street', 6480, 'Old Quarter'),
  ('flat@36,-96', '36 High Street', 6480, 'Old Quarter'),
  ('flat@-31,-70', '3 Square Row', 4540, 'Old Quarter'),
  ('flat@31,-70', '5 Square Row', 4540, 'Old Quarter'),
  ('house@-207,-38', '53 Park Lane', 2090, 'Old Quarter'),
  ('house@-207,-23', '45 Park Lane', 2310, 'Old Quarter'),
  ('house@-207,-8', '50 Park Lane', 2390, 'Old Quarter'),
  ('house@-207,7', '37 Park Lane', 2190, 'Old Quarter'),
  ('house@-202,22', '36 Park Lane', 2050, 'Old Quarter'),
  ('house@-197,-63', '6 Park Lane', 2300, 'Old Quarter'),
  ('house@-197,37', '56 Park Lane', 2250, 'Old Quarter'),
  ('house@-187,-83', '50 Park Lane', 2030, 'Old Quarter'),
  ('house@-187,-48', '2 Park Lane', 2380, 'Old Quarter'),
  ('house@-187,-33', '23 Park Lane', 1990, 'Old Quarter'),
  ('house@-187,-18', '59 Park Lane', 2580, 'Old Quarter'),
  ('house@-187,-3', '36 Park Lane', 2360, 'Old Quarter'),
  ('house@-180,-70', '6 Park Lane', 2000, 'Old Quarter'),
  ('house@-180,25', '56 Park Lane', 2090, 'Old Quarter'),
  ('house@-175,45', '2 Park Lane', 2410, 'Old Quarter'),
  ('house@-165,25', '39 Park Lane', 2030, 'Old Quarter'),
  ('house@-160,45', '43 Park Lane', 2230, 'Old Quarter'),
  ('house@-150,25', '57 Park Lane', 2610, 'Old Quarter'),
  ('house@-145,45', '6 Park Lane', 2200, 'Old Quarter'),
  ('house@-140,-90', '42 Park Lane', 2230, 'Old Quarter'),
  ('house@-135,25', '31 Park Lane', 2460, 'Old Quarter'),
  ('house@-130,45', '35 Park Lane', 2530, 'Old Quarter'),
  ('house@-125,-90', '12 Park Lane', 2240, 'Old Quarter'),
  ('house@-120,25', '4 Park Lane', 2270, 'Old Quarter'),
  ('house@-115,45', '39 Park Lane', 2350, 'Old Quarter'),
  ('house@-110,-90', '60 Park Lane', 2630, 'Old Quarter'),
  ('house@-105,25', '33 Park Lane', 2090, 'Old Quarter'),
  ('house@-100,45', '60 Park Lane', 2440, 'Old Quarter'),
  ('house@-95,-90', '27 Park Lane', 2080, 'Old Quarter'),
  ('house@-87,22', '49 Park Lane', 2300, 'Old Quarter'),
  ('house@-85,45', '44 Park Lane', 2080, 'Old Quarter'),
  ('house@-80,-95', '33 Park Lane', 2400, 'Old Quarter'),
  ('house@-72,-78', '6 Park Lane', 2130, 'Old Quarter'),
  ('house@-72,-63', '43 Park Lane', 2070, 'Old Quarter'),
  ('house@-72,-38', '14 Park Lane', 2190, 'Old Quarter'),
  ('house@-72,-23', '11 Park Lane', 2540, 'Old Quarter'),
  ('house@-72,-8', '2 Park Lane', 2200, 'Old Quarter'),
  ('house@-72,7', '19 Park Lane', 2130, 'Old Quarter'),
  ('house@-27,26', '24 Quarter Lane', 2580, 'Old Quarter'),
  ('house@-24,3', '34 Quarter Lane', 2330, 'Old Quarter'),
  ('house@-17,-79', '52 Quarter Lane', 2420, 'Old Quarter'),
  ('house@-12,26', '6 Quarter Lane', 2120, 'Old Quarter'),
  ('house@-7,6', '44 Quarter Lane', 2140, 'Old Quarter'),
  ('house@-2,-79', '11 Quarter Lane', 2260, 'Old Quarter'),
  ('house@3,26', '24 Quarter Lane', 2460, 'Old Quarter'),
  ('house@8,6', '43 Quarter Lane', 2220, 'Old Quarter'),
  ('house@13,-79', '55 Quarter Lane', 2500, 'Old Quarter'),
  ('house@18,26', '38 Quarter Lane', 2200, 'Old Quarter'),
  ('house@26,3', '20 Quarter Lane', 2160, 'Old Quarter'),
  ('house@41,28', '23 Quarter Lane', 2150, 'Old Quarter'),
  ('warehouse@76,-89', 'Store shed', 1120, 'Harbour'),
  ('warehouse@76,11', 'Store shed', 1120, 'Harbour'),
  ('warehouse@96,-99', 'Store shed', 1120, 'Harbour'),
  ('warehouse@96,-79', 'Store shed', 1120, 'Harbour'),
  ('warehouse@96,11', 'Store shed', 1120, 'Harbour'),
  ('warehouse@116,-79', 'Store shed', 1120, 'Harbour'),
  ('warehouse@116,11', 'Store shed', 1120, 'Harbour'),
  ('warehouse@121,-99', 'Store shed', 1120, 'Harbour'),
  ('warehouse@141,-79', 'Store shed', 1120, 'Harbour'),
  ('warehouse@141,11', 'Store shed', 1120, 'Harbour'),
  ('warehouse@146,-99', 'Store shed', 1120, 'Harbour'),
  ('warehouse@146,-59', 'Store shed', 1120, 'Harbour'),
  ('warehouse@146,-34', 'Store shed', 1120, 'Harbour'),
  ('warehouse@146,-9', 'Store shed', 1120, 'Harbour'),
  ('warehouse@161,16', 'Store shed', 1120, 'Harbour'),
  ('warehouse@166,-89', 'Store shed', 1120, 'Harbour'),
  ('warehouse@166,-64', 'Store shed', 1120, 'Harbour'),
  ('warehouse@166,-39', 'Store shed', 1120, 'Harbour'),
  ('warehouse@166,-14', 'Store shed', 1120, 'Harbour'),
  ('flat@-108,38', '4 Park Lane', 5180, 'Old Quarter'),
  ('flat@-86,38', '6 Park Lane', 4540, 'Old Quarter'),
  ('warehouse@168,-8', 'Warehouse 1', 3950, 'Harbour'),
  ('warehouse@168,-66', 'Warehouse 2', 3540, 'Harbour'),
  ('warehouse@96,-86', 'Delivery depot', 2160, 'Harbour'),
  ('kiosk@120,78', 'Seafood shack', 1620, 'Harbour'),
  ('warehouse@540,-112', 'Isle cold store', 1340, 'Industrial Isle'),
  ('tower@-30,-132', '2 Exchange Place', 22180, 'Business Centre'),
  ('tower@28,-132', '4 Exchange Place', 16630, 'Business Centre'),
  ('tower@-38,-186', '38 Capital Avenue', 11200, 'Business Centre'),
  ('tower@38,-186', '38 Capital Avenue', 13440, 'Business Centre'),
  ('tower@80,-188', '80 Capital Avenue', 7840, 'Business Centre'),
  ('tower@100,-150', 'Harbour View Tower', 56450, 'Business Centre'),
  ('house@-355,-235', 'Farmhouse', 2340, 'Greenfields'),
  ('house@-232,-296', 'Farmhouse', 2340, 'Greenfields'),
  ('villa@-309,43', '3 Villa Point Road', 12940, 'Villa Point'),
  ('villa@-339,37', '7 Villa Point Road', 12940, 'Villa Point'),
  ('villa@-349,65', '11 Villa Point Road', 12940, 'Villa Point'),
  ('villa@-410,13', '15 Villa Point Road', 12940, 'Villa Point'),
  ('villa@-414,43', '19 Villa Point Road', 12940, 'Villa Point'),
  ('villa@-447,12', '23 Villa Point Road', 12940, 'Villa Point'),
  ('villa@-515,42', '27 Villa Point Road', 12940, 'Villa Point'),
  ('villa@-542,69', '31 Villa Point Road', 12940, 'Villa Point'),
  ('villa@-516,83', '35 Villa Point Road', 12940, 'Villa Point'),
  ('villa@-540,146', '39 Villa Point Road', 12940, 'Villa Point'),
  ('villa@-516,128', '43 Villa Point Road', 12940, 'Villa Point'),
  ('villa@-500,167', '47 Villa Point Road', 12940, 'Villa Point'),
  ('villa@-453,163', '51 Villa Point Road', 12940, 'Villa Point'),
  ('villa@-429,127', '55 Villa Point Road', 12940, 'Villa Point'),
  ('villa@-372,136', '59 Villa Point Road', 12940, 'Villa Point'),
  ('villa@-385,109', '63 Villa Point Road', 12940, 'Villa Point'),
  ('villa@-343,120', '67 Villa Point Road', 12940, 'Villa Point'),
  ('villa@-315,101', '71 Villa Point Road', 12940, 'Villa Point')
on conflict (lot) do update set name = excluded.name, price = excluded.price, area = excluded.area;

-- ---------- rules ----------
create or replace function public.ci_level(p_xp int) returns int language sql immutable set search_path = '' as $$
  select case when p_xp >= 900 then 4 when p_xp >= 550 then 3 when p_xp >= 300 then 2 when p_xp >= 120 then 1 else 0 end $$;
-- every 7.5 minutes Capital Stadium hosts a 90-second match: the shops want 30 more boxes and pay 15 % more
create or replace function public.ci_match_on() returns boolean language sql stable set search_path = '' as $$
  select mod(floor(extract(epoch from now()))::bigint, 450) < 90 $$;
create or replace function public.ci_demand(b public.ci_buyers) returns numeric language sql stable set search_path = '' as $$
  select least(b.max_demand + case when b.buyer = 'shops' and public.ci_match_on() then 30 else 0 end, b.demand + extract(epoch from (now() - b.updated_at)) / b.refill_s) $$;
create or replace function public.ci_price(b public.ci_buyers) returns numeric language sql stable set search_path = '' as $$
  select round(b.base_price * (0.7 + 0.3 * least(1, public.ci_demand(b) / b.max_demand)) * case when b.buyer = 'shops' and public.ci_match_on() then 1.15 else 1 end, 2) $$;

create or replace function public.ci_me() returns uuid language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Sign in first'; end if;
  if not exists (select 1 from public.ci_players where id = u) then raise exception 'Join the island first'; end if;
  return u;
end $$;

-- take boxes or crates out of a store, with their share of what they cost
create or replace function public.ci_take(p uuid, p_site text, p_qty int) returns numeric language plpgsql security definer set search_path = '' as $$
declare st public.ci_stock; basis numeric;
begin
  select * into st from public.ci_stock where player = p and site = p_site for update;
  if not found or st.qty < p_qty then raise exception 'Not enough in store'; end if;
  basis := round(st.cost * p_qty / st.qty, 2);
  update public.ci_stock set qty = qty - p_qty, cost = case when qty - p_qty = 0 then 0 else greatest(0, cost - basis) end where player = p and site = p_site;
  return basis;
end $$;

-- a trip arrives: once only
create or replace function public.ci_finish(p_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.ci_shipments; rev numeric; profit numeric; gained int;
begin
  update public.ci_shipments set status = 'delivered', delivered_at = now() where id = p_id and status = 'travelling' returning * into s;
  if not found then return null; end if; -- already delivered: no second reward
  if s.kind = 'crop' then
    insert into public.ci_stock as st (player, site, qty, cost) values (s.player, 'plant_in', s.qty, s.basis + s.fee)
      on conflict (player, site) do update set qty = st.qty + excluded.qty, cost = st.cost + excluded.cost;
    return jsonb_build_object('kind', 'crop', 'qty', s.qty);
  end if;
  rev := s.qty * s.price; profit := rev - s.basis - s.fee; gained := least(60, greatest(0, floor(profit / 10)))::int; -- XP from real profit, capped per delivery
  update public.ci_players set cash = cash + rev, xp = xp + gained where id = s.player;
  return jsonb_build_object('kind', 'food', 'qty', s.qty, 'revenue', rev, 'profit', profit, 'xp', gained);
end $$;

-- bring a player's world up to date: finished jobs into the stores, long-overdue trips delivered, free vehicles take booked trips
create or replace function public.ci_settle(p uuid) returns void language plpgsql security definer set search_path = '' as $$
declare j record; s record; lvl int; busy int; lim int;
begin
  for j in select * from public.ci_jobs where player = p and not done and ends_at <= now() for update loop
    update public.ci_jobs set done = true where id = j.id;
    insert into public.ci_stock as st (player, site, qty, cost) values (p, case when j.kind = 'grow' then 'farm' else 'plant_out' end, j.qty, j.cost)
      on conflict (player, site) do update set qty = st.qty + excluded.qty, cost = st.cost + excluded.cost;
  end loop;
  for s in select s2.id from public.ci_shipments s2 join public.ci_routes r on r.from_node = s2.from_node and r.to_node = s2.to_node
           where s2.player = p and s2.status = 'travelling' and now() > s2.depart_at + (r.meters / 3) * interval '1 second' loop
    perform public.ci_finish(s.id); -- the game was closed during the trip: it still arrives, in its own time
  end loop;
  select public.ci_level(xp) into lvl from public.ci_players where id = p;
  for s in select * from public.ci_shipments where player = p and status = 'queued' order by created_at for update loop
    select count(*) into busy from public.ci_shipments where player = p and status = 'travelling' and vehicle = s.vehicle;
    lim := case when s.vehicle = 'truck' then (case when lvl >= 3 then 2 else 1 end) else (case when lvl >= 1 then 1 else 0 end) end; -- trucks and vans you own
    if busy < lim then
      update public.ci_shipments set status = 'travelling', depart_at = now() where id = s.id;
    end if;
  end loop;
end $$;

-- everything the game shows, in one answer
create or replace function public.ci_state() returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me();
begin
  perform public.ci_settle(u);
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
    'match', public.ci_match_on(), 'match_in', 450 - mod(floor(extract(epoch from now()))::bigint, 450));
end $$;

create or replace function public.ci_join(p_name text, p_color text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Sign in first'; end if;
  if p_name is null or p_name !~ '^[A-Za-z0-9][A-Za-z0-9 _.-]{1,18}[A-Za-z0-9]$' then raise exception 'Names are 3 to 20 letters or numbers'; end if;
  if exists (select 1 from public.ci_players where lower(name) = lower(p_name) and id <> u) then raise exception 'That name is taken'; end if;
  insert into public.ci_players as pl (id, name, color) values (u, p_name, case when p_color ~ '^#[0-9a-fA-F]{6}$' then p_color else '#4c8dff' end)
    on conflict (id) do update set name = excluded.name, color = excluded.color, last_seen = now();
  insert into public.ci_stock (player, site) select u, s from unnest(array['farm', 'plant_in', 'plant_out']) s on conflict do nothing;
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
  update public.ci_players set cash = cash - cost where id = u and cash >= cost;
  if not found then raise exception 'Not enough cash'; end if;
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
  update public.ci_players set cash = cash - fee where id = u and cash >= fee;
  if not found then raise exception 'Not enough cash'; end if;
  basis := public.ci_take(u, 'plant_in', p_qty);
  insert into public.ci_jobs (player, kind, qty, cost, ends_at) values (u, 'process', p_qty, basis + fee, now() + p_qty * interval '0.6 seconds');
  return public.ci_state();
end $$;

create or replace function public.ci_ship(p_id uuid, p_kind text, p_qty int, p_buyer text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); ex public.ci_shipments; b public.ci_buyers; lvl int; meters numeric; fee numeric; v text; dest text; price numeric; d numeric; inbound int; instore int; basis numeric;
begin
  select * into ex from public.ci_shipments where id = p_id;
  if found then if ex.player <> u then raise exception 'Not your shipment'; end if; return public.ci_state(); end if; -- the same booking sent twice books once
  perform 1 from public.ci_players where id = u for update;
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
  update public.ci_players set cash = cash - fee where id = u and cash >= fee;
  if not found then raise exception 'Not enough cash for the shipping'; end if;
  insert into public.ci_shipments (id, player, kind, from_node, to_node, buyer, qty, vehicle, fee, price, basis, status)
    values (p_id, u, p_kind, case when p_kind = 'crop' then 'FA' else 'P' end, dest, case when p_kind = 'food' then p_buyer end, p_qty, v, fee, price, basis, 'queued');
  perform public.ci_settle(u);
  return public.ci_state();
end $$;

create or replace function public.ci_deliver(p_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); s public.ci_shipments; meters numeric; res jsonb;
begin
  perform 1 from public.ci_players where id = u for update;
  select * into s from public.ci_shipments where id = p_id and player = u;
  if not found then raise exception 'No such shipment'; end if;
  if s.status = 'delivered' then return public.ci_state() || jsonb_build_object('result', null); end if; -- already paid: nothing more
  if s.status <> 'travelling' then raise exception 'Still waiting for a vehicle'; end if;
  select r.meters into meters from public.ci_routes r where r.from_node = s.from_node and r.to_node = s.to_node;
  if now() < s.depart_at + (meters / 16) * interval '1 second' then raise exception 'Not there yet'; end if; -- faster than any vehicle drives
  res := public.ci_finish(p_id);
  perform public.ci_settle(u);
  return public.ci_state() || jsonb_build_object('result', res);
end $$;

create or replace function public.ci_buy_property(p_lot text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); l public.ci_lots;
begin
  perform 1 from public.ci_players where id = u for update;
  select * into l from public.ci_lots where lot = p_lot;
  if not found then raise exception 'That building is not for sale'; end if;
  if exists (select 1 from public.ci_property where lot = p_lot) then raise exception 'Someone already owns this'; end if;
  update public.ci_players set cash = cash - l.price, xp = xp + 25 where id = u and cash >= l.price;
  if not found then raise exception 'Not enough cash'; end if;
  begin
    insert into public.ci_property (lot, owner, price) values (p_lot, u, l.price);
  exception when unique_violation then
    raise exception 'Someone else bought it first'; -- undoes the payment too
  end;
  return public.ci_state();
end $$;

create or replace function public.ci_list_food(p_id uuid, p_qty int, p_price numeric) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); basis numeric;
begin
  if exists (select 1 from public.ci_listings where id = p_id) then return public.ci_state(); end if;
  perform 1 from public.ci_players where id = u for update;
  perform public.ci_settle(u);
  if p_qty is null or p_qty < 1 or p_qty > 200 then raise exception 'Offer 1 to 200 boxes'; end if;
  if p_price is null or p_price < 1 or p_price > 100 then raise exception 'Prices are $1 to $100 a box'; end if;
  if (select count(*) from public.ci_listings where seller = u and status = 'open') >= 5 then raise exception 'At most 5 offers at a time'; end if;
  basis := public.ci_take(u, 'plant_out', p_qty); -- held while the offer is open
  insert into public.ci_listings (id, seller, qty, price, cost) values (p_id, u, p_qty, round(p_price, 2), basis);
  return public.ci_state();
end $$;

create or replace function public.ci_cancel_listing(p_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); l public.ci_listings;
begin
  update public.ci_listings set status = 'cancelled', closed_at = now() where id = p_id and seller = u and status = 'open' returning * into l;
  if found then
    insert into public.ci_stock as st (player, site, qty, cost) values (u, 'plant_out', l.qty, l.cost)
      on conflict (player, site) do update set qty = st.qty + excluded.qty, cost = st.cost + excluded.cost;
  end if;
  return public.ci_state();
end $$;

create or replace function public.ci_buy_listing(p_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); l public.ci_listings; total numeric; have int;
begin
  select * into l from public.ci_listings where id = p_id for update; -- one buyer at a time
  if not found or l.status <> 'open' then raise exception 'That offer has gone'; end if;
  if l.seller = u then raise exception 'That is your own offer'; end if;
  total := l.qty * l.price;
  select coalesce(max(qty), 0) into have from public.ci_stock where player = u and site = 'plant_out';
  if have + l.qty > 200 then raise exception 'Not enough room in your plant store'; end if;
  update public.ci_players set cash = cash - total where id = u and cash >= total;
  if not found then raise exception 'Not enough cash'; end if;
  update public.ci_players set cash = cash + total where id = l.seller;
  update public.ci_listings set status = 'sold', buyer = u, closed_at = now() where id = p_id;
  insert into public.ci_stock as st (player, site, qty, cost) values (u, 'plant_out', l.qty, total)
    on conflict (player, site) do update set qty = st.qty + excluded.qty, cost = st.cost + excluded.cost;
  return public.ci_state();
end $$;

-- the helpers only run inside the functions above
revoke execute on function public.ci_take(uuid, text, int) from public, anon, authenticated;
revoke execute on function public.ci_finish(uuid) from public, anon, authenticated;
revoke execute on function public.ci_settle(uuid) from public, anon, authenticated;
