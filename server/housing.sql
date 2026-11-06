-- Additive housing milestone. Existing lots, ownership, money and saves are preserved.
create schema if not exists ci_private;
revoke all on schema ci_private from public;
create table if not exists public.ci_homes (
 lot text primary key references public.ci_property(lot),
 level int not null default 0 check(level between 0 and 2),
 mode text not null default 'vacant' check(mode in ('vacant','home','rent')),
 ready timestamptz, rent_at timestamptz not null default now(),
 revision int not null default 0 check(revision>=0),
 check(level>0 or mode='vacant')
);
create table if not exists public.ci_home_ops (
 id uuid primary key, player uuid not null references public.ci_players(id) on delete cascade,
 lot text not null, action text not null, revision int not null
);
alter table public.ci_homes enable row level security;
alter table public.ci_home_ops enable row level security;
drop policy if exists "see island homes" on public.ci_homes;
create policy "see island homes" on public.ci_homes for select to authenticated using(true);
drop policy if exists "see own housing receipts" on public.ci_home_ops;
create policy "see own housing receipts" on public.ci_home_ops for select to authenticated using(player=(select auth.uid()));
revoke all on public.ci_homes, public.ci_home_ops from anon, authenticated;
grant select on public.ci_homes, public.ci_home_ops to authenticated;
insert into public.ci_lots(lot,name,price,area) values('parcel:orchard-01','1 Orchard Close',400,'Orchard Close') on conflict(lot) do nothing;

create or replace function ci_private.housing_snapshot() returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_object_agg(p.lot,jsonb_build_object(
  'level',coalesce(h.level,0),'mode',coalesce(h.mode,'vacant'),
  'ready',case when h.ready>now() then floor(extract(epoch from h.ready)*1000) else 0 end,
  'at',floor(extract(epoch from coalesce(h.rent_at,p.bought_at))*1000),
  'revision',coalesce(h.revision,0),'owner',p.owner,'name',u.name)), '{}'::jsonb)
 from public.ci_property p join public.ci_players u on u.id=p.owner
 left join public.ci_homes h on h.lot=p.lot where p.lot='parcel:orchard-01'
$$;
revoke all on function ci_private.housing_snapshot() from public, anon, authenticated;

create or replace function public.ci_home_action(p_id uuid,p_lot text,p_action text,p_revision int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=public.ci_me(); h public.ci_homes; op public.ci_home_ops; cost int:=0; income int:=0; salvage int:=0; periods int:=0;
begin
 if p_id is null or p_lot is distinct from 'parcel:orchard-01' or p_revision is null then raise exception 'Invalid housing request'; end if;
 perform 1 from public.ci_players where id=u for update;
 select * into op from public.ci_home_ops where id=p_id;
 if found then
  if op.player<>u or op.lot<>p_lot or op.action<>p_action or op.revision<>p_revision then raise exception 'Request ID already used'; end if;
  return public.ci_state();
 end if;
 if p_action='buy' then
  if p_revision<>0 or exists(select 1 from public.ci_property where lot=p_lot) then raise exception 'Someone already owns this plot'; end if;
  cost:=400;
  perform public.ci_note('Bought land: 1 Orchard Close');
  update public.ci_players set cash=cash-cost where id=u and cash>=cost;
  if not found then raise exception 'Not enough cash'; end if;
  insert into public.ci_property(lot,owner,price) values(p_lot,u,cost);
  insert into public.ci_homes(lot) values(p_lot);
 else
  if not exists(select 1 from public.ci_property where lot=p_lot and owner=u) then raise exception 'You do not own this plot'; end if;
  insert into public.ci_homes(lot) values(p_lot) on conflict(lot) do nothing;
  select * into h from public.ci_homes where lot=p_lot for update;
  if h.revision<>p_revision then raise exception 'This property changed. Review it again'; end if;
  if h.ready>now() then raise exception 'Construction is still in progress'; end if;
  h.ready:=null;
  if h.mode='rent' then
   periods:=least(6,greatest(0,floor(extract(epoch from now()-h.rent_at)/600)::int));
   income:=periods*case when h.level=2 then 18 else 10 end;
  end if;
  if p_action='build' then
   if h.level<>0 then raise exception 'There is already a house here'; end if;
   cost:=600; h.level:=1;h.mode:='vacant';h.ready:=now()+interval '20 seconds';
  elsif p_action='renovate' then
   if h.level<>1 then raise exception 'Renovation needs a standard house'; end if;
   cost:=450;h.level:=2;h.mode:='vacant';h.ready:=now()+interval '15 seconds';
  elsif p_action='demolish' then
   if h.level=0 then raise exception 'There is no house to demolish'; end if;
   cost:=75;salvage:=100;h.level:=0;h.mode:='vacant';
  elsif p_action in ('home','rent') then
   if h.level=0 then raise exception 'Build a house first'; end if;
   if h.mode=p_action then raise exception 'This house already has that use'; end if;
   h.mode:=p_action;
  elsif p_action='collect' then
   if income=0 then raise exception 'No rent is ready yet'; end if;
  else raise exception 'Unknown housing action'; end if;
  perform public.ci_note('Housing: '||p_action||' at 1 Orchard Close');
  update public.ci_players set cash=cash+income+salvage-cost where id=u and cash>=cost;
  if not found then raise exception 'Not enough cash'; end if;
  if p_action='collect' and now()-h.rent_at<interval '1 hour' then
   h.rent_at:=h.rent_at+periods*interval '10 minutes';
  else h.rent_at:=now(); end if;
  update public.ci_homes set level=h.level,mode=h.mode,ready=h.ready,rent_at=h.rent_at,revision=revision+1 where lot=p_lot;
 end if;
 insert into public.ci_home_ops(id,player,lot,action,revision) values(p_id,u,p_lot,p_action,p_revision);
 return public.ci_state();
end $$;
revoke all on function public.ci_home_action(uuid,text,text,int) from public, anon, authenticated;
grant execute on function public.ci_home_action(uuid,text,text,int) to authenticated;

-- Extend the existing state response; all old fields remain.
create or replace function public.ci_state() returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me();
begin
  perform public.ci_settle(u);
  perform public.ci_board();
  update public.ci_players set last_seen = now() where id = u;
  return jsonb_build_object(
    'housing', ci_private.housing_snapshot(),
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
