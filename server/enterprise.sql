-- Capital Island enterprise expansion. Additive; preserves original IDs, balances and stock.
create table if not exists public.ci_site_catalog(lot text primary key references public.ci_lots(lot),kind text not null,capacity int not null default 0);
create table if not exists public.ci_enterprise(player uuid primary key references public.ci_players(id) on delete cascade,state jsonb not null);
create table if not exists public.ci_enterprise_ops(id uuid primary key,player uuid not null references public.ci_players(id) on delete cascade,request jsonb not null);
create table if not exists public.ci_building_works(lot text primary key references public.ci_property(lot),demolished boolean not null default false);
create table if not exists public.ci_auctions(lot text primary key references public.ci_property(lot),seller uuid not null references public.ci_players(id),minimum numeric not null check(minimum>=100),bid numeric not null default 0 check(bid>=0),bidder uuid references public.ci_players(id),ends_at timestamptz not null,status text not null check(status in ('open','sold','expired')));
alter table public.ci_site_catalog enable row level security;
alter table public.ci_enterprise enable row level security;
alter table public.ci_enterprise_ops enable row level security;
alter table public.ci_building_works enable row level security;
alter table public.ci_auctions enable row level security;
revoke all on public.ci_site_catalog,public.ci_enterprise,public.ci_enterprise_ops,public.ci_building_works,public.ci_auctions from anon,authenticated;
grant select on public.ci_site_catalog,public.ci_building_works,public.ci_auctions to authenticated;
create policy "read enterprise catalog" on public.ci_site_catalog for select to authenticated using(true);
create policy "read building works" on public.ci_building_works for select to authenticated using(true);
create policy "read property auctions" on public.ci_auctions for select to authenticated using(true);

insert into public.ci_lots(lot,name,price,area) values('starter:0','1 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:0','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:1','2 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:1','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:2','3 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:2','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:3','4 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:3','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:4','5 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:4','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:5','6 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:5','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:6','7 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:6','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:7','8 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:7','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:8','9 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:8','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:9','10 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:9','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:10','11 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:10','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:11','12 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:11','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:12','13 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:12','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:13','14 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:13','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:14','15 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:14','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:15','16 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:15','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:16','17 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:16','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:17','18 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:17','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:18','19 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:18','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:19','20 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:19','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:20','21 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:20','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:21','22 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:21','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:22','23 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:22','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:23','24 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:23','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:24','25 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:24','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:25','26 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:25','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:26','27 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:26','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:27','28 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:27','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:28','29 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:28','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:29','30 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:29','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:30','31 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:30','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:31','32 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:31','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:32','33 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:32','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:33','34 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:33','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:34','35 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:34','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:35','36 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:35','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:36','37 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:36','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:37','38 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:37','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:38','39 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:38','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:39','40 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:39','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:40','41 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:40','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:41','42 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:41','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:42','43 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:42','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:43','44 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:43','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:44','45 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:44','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:45','46 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:45','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:46','47 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:46','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:47','48 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:47','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:48','49 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:48','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:49','50 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:49','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:50','51 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:50','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:51','52 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:51','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:52','53 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:52','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:53','54 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:53','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:54','55 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:54','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:55','56 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:55','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:56','57 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:56','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:57','58 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:57','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:58','59 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:58','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:59','60 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:59','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:60','61 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:60','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:61','62 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:61','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:62','63 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:62','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('starter:63','64 Founders Lane',250,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('starter:63','starter',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:office:0','Eastbank Office 1',650,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:office:0','office',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:shop:0','Market Arcade 1',450,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:shop:0','shop',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:office:1','Eastbank Office 2',650,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:office:1','office',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:shop:1','Market Arcade 2',450,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:shop:1','shop',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:office:2','Eastbank Office 3',650,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:office:2','office',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:shop:2','Market Arcade 3',450,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:shop:2','shop',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:office:3','Eastbank Office 4',650,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:office:3','office',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:shop:3','Market Arcade 4',450,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:shop:3','shop',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:office:4','Eastbank Office 5',650,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:office:4','office',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:shop:4','Market Arcade 5',450,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:shop:4','shop',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:office:5','Eastbank Office 6',650,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:office:5','office',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:shop:5','Market Arcade 6',450,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:shop:5','shop',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:office:6','Eastbank Office 7',650,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:office:6','office',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:shop:6','Market Arcade 7',450,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:shop:6','shop',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:office:7','Eastbank Office 8',650,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:office:7','office',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:shop:7','Market Arcade 8',450,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:shop:7','shop',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:office:8','Eastbank Office 9',650,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:office:8','office',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:shop:8','Market Arcade 9',450,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:shop:8','shop',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:office:9','Eastbank Office 10',650,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:office:9','office',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:shop:9','Market Arcade 10',450,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:shop:9','shop',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:office:10','Eastbank Office 11',650,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:office:10','office',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:shop:10','Market Arcade 11',450,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:shop:10','shop',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:office:11','Eastbank Office 12',650,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:office:11','office',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:shop:11','Market Arcade 12',450,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:shop:11','shop',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:farm:0','Riverbend Farm 1',500,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:farm:0','farm',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:port:0','Ocean Gate Berth 1',1000,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:port:0','harbour',20) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:villa:0','Coral Bay Villa 1',1600,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:villa:0','home',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:farm:1','Riverbend Farm 2',500,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:farm:1','farm',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:port:1','Ocean Gate Berth 2',1350,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:port:1','harbour',23) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:villa:1','Coral Bay Villa 2',1600,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:villa:1','home',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:farm:2','Riverbend Farm 3',500,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:farm:2','farm',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:port:2','Ocean Gate Berth 3',1700,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:port:2','harbour',30) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:villa:2','Coral Bay Villa 3',1600,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:villa:2','home',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:farm:3','Riverbend Farm 4',500,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:farm:3','farm',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:port:3','Ocean Gate Berth 4',2050,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:port:3','harbour',36) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:villa:3','Coral Bay Villa 4',1600,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:villa:3','home',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:farm:4','Riverbend Farm 5',500,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:farm:4','farm',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:port:4','Ocean Gate Berth 5',1000,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:port:4','harbour',20) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:villa:4','Coral Bay Villa 5',1600,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:villa:4','home',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:farm:5','Riverbend Farm 6',500,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:farm:5','farm',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:port:5','Ocean Gate Berth 6',1350,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:port:5','harbour',23) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:villa:5','Coral Bay Villa 6',1600,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:villa:5','home',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:farm:6','Riverbend Farm 7',500,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:farm:6','farm',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:port:6','Ocean Gate Berth 7',1700,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:port:6','harbour',30) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:villa:6','Coral Bay Villa 7',1600,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:villa:6','home',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:farm:7','Riverbend Farm 8',500,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:farm:7','farm',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:port:7','Ocean Gate Berth 8',2050,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:port:7','harbour',36) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:villa:7','Coral Bay Villa 8',1600,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:villa:7','home',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('ridge:mine:0','Coal concession 1',550,'North Ridge') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('ridge:mine:0','mine',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('ridge:mine:1','Copper concession 1',750,'North Ridge') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('ridge:mine:1','mine',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('ridge:mine:2','Oil concession 1',950,'North Ridge') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('ridge:mine:2','mine',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('ridge:mine:3','Coal concession 2',550,'North Ridge') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('ridge:mine:3','mine',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('ridge:mine:4','Copper concession 2',750,'North Ridge') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('ridge:mine:4','mine',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('ridge:mine:5','Oil concession 2',950,'North Ridge') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('ridge:mine:5','mine',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:factory:0','Seabright Works 1',1800,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:factory:0','factory',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:hotel:0','Coral Bay Hotel 1',2400,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:hotel:0','hotel',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:factory:1','Seabright Works 2',1800,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:factory:1','factory',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:hotel:1','Coral Bay Hotel 2',2400,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:hotel:1','hotel',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:factory:2','Seabright Works 3',1800,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:factory:2','factory',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:hotel:2','Coral Bay Hotel 3',2400,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:hotel:2','hotel',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:factory:3','Seabright Works 4',1800,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:factory:3','factory',0) on conflict(lot) do nothing;
insert into public.ci_lots(lot,name,price,area) values('east:hotel:3','Coral Bay Hotel 4',2400,'Eastbank') on conflict(lot) do nothing;
insert into public.ci_site_catalog(lot,kind,capacity) values('east:hotel:3','hotel',0) on conflict(lot) do nothing;

create or replace function ci_private.business_kind(p_lot text) returns text language sql stable set search_path='' as $$
 select coalesce((select kind from public.ci_site_catalog where lot=p_lot),case split_part(p_lot,'@',1) when 'tower' then 'office' when 'warehouse' then 'harbour' when 'shophouse' then 'shop' when 'kiosk' then 'shop' else 'home' end)
$$;
create or replace function ci_private.has_business(u uuid,k text) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.ci_property p left join public.ci_building_works w using(lot) where p.owner=u and ci_private.business_kind(p.lot)=k and not coalesce(w.demolished,false))
$$;
create or replace function ci_private.share_price(k text,t bigint) returns int language plpgsql immutable set search_path='' as $$
declare b int;m int;tick bigint:=floor(t/20000.0);
begin
 if k='MAR' then b:=38;m:=3;elsif k='PAL' then b:=24;m:=5;elsif k='MET' then b:=54;m:=7;else raise exception 'Unknown share';end if;
 return greatest(2,floor((b+mod(tick*m,13)-6)*case when mod(tick,90)<3 then .65 else 1 end)::int);
end $$;
create or replace function ci_private.enterprise_snapshot(u uuid) returns jsonb language plpgsql set search_path='' as $$
declare s jsonb;j jsonb;keep jsonb:='[]';t bigint:=floor(extract(epoch from now())*1000);g text;v int;startlot text;
begin
 insert into public.ci_enterprise(player,state) values(u,'{"revision":0,"stock":{},"basis":{},"used":{},"jobs":[],"ships":[],"positions":{},"profit":0,"portLevel":1,"completed":0}') on conflict(player) do nothing;
 select state into s from public.ci_enterprise where player=u for update;
 if s->>'starter' is null then
  perform pg_advisory_xact_lock(hashtext('ci_founders_starter_allocation'));
  select c.lot into startlot from public.ci_site_catalog c left join public.ci_property p using(lot) where c.kind='starter' and p.lot is null order by c.lot limit 1;
  if startlot is null then raise exception 'This island has reached its 64 resident capacity';end if;
  insert into public.ci_property(lot,owner,price) values(startlot,u,0);
  s:=jsonb_set(s,'{starter}',to_jsonb(startlot));
 end if;
 for j in select value from jsonb_array_elements(s->'jobs') loop
  if (j->>'end')::bigint<=t then
   g:=j->>'good';s:=jsonb_set(s,array['stock',g],to_jsonb(coalesce((s->'stock'->>g)::int,0)+(j->>'qty')::int));
   s:=jsonb_set(s,array['basis',g],to_jsonb(coalesce((s->'basis'->>g)::numeric,0)+(j->>'cost')::numeric));
  else keep:=keep||jsonb_build_array(j);end if;
 end loop;
 s:=jsonb_set(s,'{jobs}',keep);update public.ci_enterprise set state=s where player=u;return s;
end $$;

create or replace function public.ci_enterprise_action(p_id uuid,p_action text,p_item text,p_qty int,p_revision int,p_price int default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.ci_me();s jsonb;req jsonb:=jsonb_build_array(p_action,p_item,p_qty,p_revision,p_price);old public.ci_enterprise_ops;g text;qty int;basis numeric;delta numeric:=0;xp_gain int:=0;t bigint:=floor(extract(epoch from now())*1000);cap int;units int;fee int;price int;pos jsonb;ship jsonb;foundship boolean:=false;keep jsonb:='[]';l public.ci_lots;w boolean;bad boolean;
begin
 if p_id is null or p_action is null or p_item is null or p_qty is null or p_qty<1 or p_qty>100 or p_revision is null then raise exception 'Invalid business order';end if;
 perform 1 from public.ci_players where id=u for update;
 select * into old from public.ci_enterprise_ops where id=p_id;
 if found then if old.player<>u or old.request<>req then raise exception 'Request ID already used';end if;return public.ci_state();end if;
 s:=ci_private.enterprise_snapshot(u);
 if (s->>'revision')::int<>p_revision then raise exception 'This order changed. Review it again';end if;
 select coalesce(sum(coalesce(c.capacity,20)),0)::int * power(2,(s->>'portLevel')::int-1)::int into cap from public.ci_property p left join public.ci_site_catalog c using(lot) left join public.ci_building_works b using(lot) where p.owner=u and ci_private.business_kind(p.lot)='harbour' and not coalesce(b.demolished,false);
 select coalesce(sum(value::int),0) into units from jsonb_each_text(s->'stock') where key in ('coal','copper','oil','fuel');
 if p_action='mine' then
  if not exists(select 1 from public.ci_property p where lot=p_item and owner=u and ci_private.business_kind(lot)='mine') then raise exception 'Buy this mining concession first';end if;
  if not ci_private.has_business(u,'harbour') then raise exception 'Buy a harbour for resource storage and exports';end if;
  if p_qty>25 or jsonb_array_length(s->'jobs')>0 then raise exception 'Crew busy or extraction batch exceeds 25 units';end if;
  if coalesce((s->'used'->>p_item)::int,0)+p_qty>2000 then raise exception 'Deposit exhausted';end if;
  if units+p_qty>cap then raise exception 'Harbour storage full';end if;
  g:=(array['coal','copper','oil'])[mod(split_part(p_item,':',3)::int,3)+1];fee:=case g when 'coal' then 2 when 'copper' then 3 else 4 end;
  delta:=-p_qty*fee;s:=jsonb_set(s,array['used',p_item],to_jsonb(coalesce((s->'used'->>p_item)::int,0)+p_qty));
  s:=jsonb_set(s,'{jobs}',jsonb_build_array(jsonb_build_object('lot',p_item,'good',g,'qty',p_qty,'cost',-delta,'start',t,'end',t+p_qty*2000)));
 elsif p_action='refine' then
  if not ci_private.has_business(u,'factory') or not ci_private.has_business(u,'harbour') then raise exception 'Own a factory and a harbour to refine oil';end if;
  if p_qty>25 or jsonb_array_length(s->'jobs')>0 then raise exception 'Production crew busy or batch too large';end if;
  qty:=coalesce((s->'stock'->>'oil')::int,0);if qty<p_qty then raise exception 'Not enough crude oil';end if;
  basis:=(s->'basis'->>'oil')::numeric*p_qty/qty;delta:=-p_qty*3;
  s:=jsonb_set(s,'{stock,oil}',to_jsonb(qty-p_qty));s:=jsonb_set(s,'{basis,oil}',to_jsonb((s->'basis'->>'oil')::numeric-basis));
  s:=jsonb_set(s,'{jobs}',jsonb_build_array(jsonb_build_object('kind','refine','lot',(select p.lot from public.ci_property p where p.owner=u and ci_private.business_kind(p.lot)='factory' and not exists(select 1 from public.ci_building_works w where w.lot=p.lot and w.demolished) limit 1),'good','fuel','qty',p_qty,'cost',basis-delta,'start',t,'end',t+p_qty*3000)));
 elsif p_action='export' then
  if not ci_private.has_business(u,'harbour') or p_qty>cap then raise exception 'A harbour with enough cargo capacity is required';end if;
  if p_item not in ('coal','copper','oil','fuel') or jsonb_array_length(s->'ships')>=2 then raise exception 'Choose a resource and a free export slot';end if;
  qty:=coalesce((s->'stock'->>p_item)::int,0);if qty<p_qty then raise exception 'Not enough stock';end if;
  basis:=coalesce((s->'basis'->>p_item)::numeric,0)*p_qty/qty;delta:=-35;price:=case p_item when 'coal' then 8 when 'copper' then 13 when 'fuel' then 30 else 18 end;
  s:=jsonb_set(s,array['stock',p_item],to_jsonb(qty-p_qty));s:=jsonb_set(s,array['basis',p_item],to_jsonb((s->'basis'->>p_item)::numeric-basis));
  s:=jsonb_set(s,'{ships}',(s->'ships')||jsonb_build_array(jsonb_build_object('id',p_id,'good',p_item,'qty',p_qty,'basis',basis,'fee',35,'payout',p_qty*price,'start',t,'sea',t+90000,'end',t+150000)));
 elsif p_action='collect' then
  for ship in select value from jsonb_array_elements(s->'ships') loop
   if ship->>'id'=p_item then
    foundship:=true;if (ship->>'end')::bigint>t then raise exception 'Cargo has not arrived';end if;delta:=(ship->>'payout')::numeric;
    basis:=delta-(ship->>'basis')::numeric-(ship->>'fee')::numeric;s:=jsonb_set(s,'{profit}',to_jsonb((s->>'profit')::numeric+basis));
    s:=jsonb_set(s,'{completed}',to_jsonb((s->>'completed')::int+1));xp_gain:=least(60,greatest(1,floor(basis/4)::int));
   else keep:=keep||jsonb_build_array(ship);end if;
  end loop;
  if not foundship then raise exception 'Shipment already collected or missing';end if;s:=jsonb_set(s,'{ships}',keep);
 elsif p_action in ('wholesale','resell') then
  if not ci_private.has_business(u,'shop') then raise exception 'Buy a shop to run a resale business';end if;
  if p_item not in ('sneakers','electronics') or p_qty>25 then raise exception 'Choose retail goods and 1-25 units';end if;
  qty:=coalesce((s->'stock'->>p_item)::int,0);basis:=coalesce((s->'basis'->>p_item)::numeric,0);
  if p_action='wholesale' then
   if (select coalesce(sum(value::int),0) from jsonb_each_text(s->'stock') where key in ('sneakers','electronics'))+p_qty>40 then raise exception 'Your stores are full';end if;
   delta:=-p_qty*case p_item when 'sneakers' then 18 else 30 end;qty:=qty+p_qty;basis:=basis-delta;
  else
   if qty<p_qty then raise exception 'Not enough stock';end if;
   delta:=p_qty*case p_item when 'sneakers' then 24 else 39 end;
   s:=jsonb_set(s,'{profit}',to_jsonb((s->>'profit')::numeric+delta-basis*p_qty/qty));xp_gain:=least(30,floor((delta-basis*p_qty/qty)/4)::int);basis:=basis-basis*p_qty/qty;qty:=qty-p_qty;
  end if;
  s:=jsonb_set(s,array['stock',p_item],to_jsonb(qty));s:=jsonb_set(s,array['basis',p_item],to_jsonb(basis));
 elsif p_action in ('buyshare','sellshare') then
  if not ci_private.has_business(u,'office') then raise exception 'Buy an office to access the trading desk';end if;
  if mod(floor(t/20000.0)::bigint,30)>=24 then raise exception 'Market closed';end if;
  price:=ci_private.share_price(p_item,t);if p_price is distinct from price then raise exception 'Price moved. Review the new quote';end if;fee:=greatest(1,ceil(p_qty*price*.01)::int);
  pos:=coalesce(s->'positions'->p_item,'{"qty":0,"cost":0}');qty:=(pos->>'qty')::int;basis:=(pos->>'cost')::numeric;
  if p_action='buyshare' then if qty+p_qty>1000 then raise exception 'Position limit reached';end if;delta:=-p_qty*price-fee;qty:=qty+p_qty;basis:=basis-delta;
  else if qty<p_qty then raise exception 'Not enough shares';end if;delta:=p_qty*price-fee;s:=jsonb_set(s,'{profit}',to_jsonb((s->>'profit')::numeric+delta-basis*p_qty/qty));basis:=basis-basis*p_qty/qty;qty:=qty-p_qty;end if;
  s:=jsonb_set(s,'{positions}',jsonb_set(s->'positions',array[p_item],jsonb_build_object('qty',qty,'cost',basis)));
 elsif p_action='portupgrade' then
  if not ci_private.has_business(u,'harbour') or (s->>'portLevel')::int>=3 then raise exception 'Own a harbour below grade 3';end if;
  delta:=-800*(s->>'portLevel')::int;s:=jsonb_set(s,'{portLevel}',to_jsonb((s->>'portLevel')::int+1));
 elsif p_action in ('demolish','rebuild') then
  select * into l from public.ci_lots where lot=p_item;
  if not found or not exists(select 1 from public.ci_property where lot=p_item and owner=u) or ci_private.business_kind(p_item) in ('starter','mine') or p_item='parcel:orchard-01' then raise exception 'You cannot change this building';end if;
  if exists(select 1 from public.ci_auctions where lot=p_item and status='open') then raise exception 'This property is at auction';end if;
  select demolished into w from public.ci_building_works where lot=p_item;w:=coalesce(w,false);
  if (p_action='demolish' and w) or (p_action='rebuild' and not w) then raise exception 'This building already changed';end if;
  if p_action='demolish' and ci_private.business_kind(p_item)='harbour' and (jsonb_array_length(s->'jobs')>0 or jsonb_array_length(s->'ships')>0) then raise exception 'Finish extraction and exports before demolishing a harbour';end if;
  delta:=-case when p_action='demolish' then greatest(75,ceil(l.price*.06)) else greatest(150,ceil(l.price*.5)) end;
  if p_price is distinct from -delta then raise exception 'Property quote changed. Review the current catalog price';end if;
  insert into public.ci_building_works(lot,demolished) values(p_item,p_action='demolish') on conflict(lot) do update set demolished=excluded.demolished;
 else raise exception 'Unknown business action';end if;
 perform public.ci_note('Business: '||p_action||' '||p_item);
 update public.ci_players set cash=cash+delta,xp=xp+xp_gain where id=u and cash+delta>=0;
 if not found then raise exception 'Not enough cash';end if;
 s:=jsonb_set(s,'{revision}',to_jsonb(p_revision+1));update public.ci_enterprise set state=s where player=u;
 insert into public.ci_enterprise_ops(id,player,request) values(p_id,u,req);return public.ci_state();
end $$;
revoke all on function public.ci_enterprise_action(uuid,text,text,int,int,int) from public,anon,authenticated;
grant execute on function public.ci_enterprise_action(uuid,text,text,int,int,int) to authenticated;

create or replace function public.ci_auction_action(p_id uuid,p_action text,p_lot text,p_amount numeric default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid:=public.ci_me();a public.ci_auctions;req jsonb:=jsonb_build_array('auction',p_action,p_lot,p_amount);old public.ci_enterprise_ops;owner_id uuid;
begin
 if p_id is null or p_lot is null or p_action is null or p_amount is null or p_amount<>trunc(p_amount) or p_amount<0 or p_amount>100000000 then raise exception 'Invalid auction order';end if;
 -- One lock order for all multi-player cash/ownership transfers, including outbid refunds.
 perform pg_advisory_xact_lock(hashtext('ci_property_auctions'));
 select * into old from public.ci_enterprise_ops where id=p_id;
 if found then if old.player<>u or old.request<>req then raise exception 'Request ID already used';end if;return public.ci_state();end if;
 perform 1 from public.ci_players where id=u for update;
 select owner into owner_id from public.ci_property where lot=p_lot for update;
 select * into a from public.ci_auctions where lot=p_lot for update;
 if p_action='list' then
  if owner_id is distinct from u or ci_private.business_kind(p_lot) in ('starter','mine') or p_lot='parcel:orchard-01' then raise exception 'Choose an owned non-starter building';end if;
  if a.status='open' or p_amount<100 then raise exception 'Auction already open or minimum too low';end if;
  if exists(select 1 from public.ci_building_works where lot=p_lot and demolished) then raise exception 'Rebuild before listing';end if;
  if ci_private.business_kind(p_lot)='harbour' and exists(select 1 from public.ci_enterprise where player=u and (jsonb_array_length(state->'jobs')>0 or jsonb_array_length(state->'ships')>0)) then raise exception 'Finish extraction and exports before selling this harbour';end if;
  insert into public.ci_auctions(lot,seller,minimum,bid,bidder,ends_at,status) values(p_lot,u,p_amount,0,null,now()+interval '5 minutes','open') on conflict(lot) do update set seller=u,minimum=p_amount,bid=0,bidder=null,ends_at=excluded.ends_at,status='open';
 elsif p_action='bid' then
  if a.status is distinct from 'open' or a.ends_at<=now() or a.seller=u or a.bidder=u or p_amount<(case when a.bid>0 then a.bid+10 else a.minimum end) then raise exception 'Invalid, expired or insufficient bid';end if;
  perform public.ci_note('Property auction bid');update public.ci_players set cash=cash-p_amount where id=u and cash>=p_amount;if not found then raise exception 'Not enough cash';end if;
  if a.bidder is not null then perform public.ci_note('Outbid refund');update public.ci_players set cash=cash+a.bid where id=a.bidder;end if;
  update public.ci_auctions set bid=p_amount,bidder=u where lot=p_lot;
 elsif p_action='settle' then
  if a.status is distinct from 'open' or a.ends_at>now() then raise exception 'Auction has not ended or already settled';end if;
  if a.bidder is not null then
   if owner_id<>a.seller then raise exception 'Ownership changed; settlement stopped';end if;
   update public.ci_property set owner=a.bidder,price=a.bid,bought_at=now() where lot=p_lot;
   perform public.ci_note('Property auction sale');update public.ci_players set cash=cash+a.bid where id=a.seller;
  end if;
  update public.ci_auctions set status=case when a.bidder is null then 'expired' else 'sold' end where lot=p_lot;
 else raise exception 'Unknown auction action';end if;
 insert into public.ci_enterprise_ops(id,player,request) values(p_id,u,req);return public.ci_state();
end $$;
revoke all on function public.ci_auction_action(uuid,text,text,numeric) from public,anon,authenticated;
grant execute on function public.ci_auction_action(uuid,text,text,numeric) to authenticated;
revoke all on function ci_private.business_kind(text),ci_private.has_business(uuid,text),ci_private.share_price(text,bigint),ci_private.enterprise_snapshot(uuid) from public,anon,authenticated;

create or replace function public.ci_state() returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); ent jsonb;
begin
  perform 1 from public.ci_players where id=u for update;
  ent:=ci_private.enterprise_snapshot(u);
  perform public.ci_settle(u);
  perform public.ci_board();
  update public.ci_players set last_seen = now() where id = u;
  return jsonb_build_object(
    'enterprise',ent,
    'catalogPrices',coalesce((select jsonb_object_agg(lot,price) from public.ci_lots),'{}'::jsonb),
    'buildingWorks',coalesce((select jsonb_object_agg(lot,jsonb_build_object('demolished',demolished)) from public.ci_building_works),'{}'::jsonb),
    'auctions',coalesce((select jsonb_agg(jsonb_build_object('lot',a.lot,'name',l.name,'seller',a.seller,'seller_name',p.name,'minimum',a.minimum,'bid',a.bid,'bidder',a.bidder,'ends_at',a.ends_at,'status',a.status)) from public.ci_auctions a join public.ci_lots l using(lot) join public.ci_players p on p.id=a.seller where a.status='open'),'[]'::jsonb),
    'residents',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'color',p.color,'online',p.last_seen>now()-interval '1 minute','properties',coalesce((select jsonb_agg(lot) from public.ci_property where owner=p.id),'[]'::jsonb))) from public.ci_players p),'[]'::jsonb),
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

create or replace function public.ci_grow(p_qty int) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); lvl int; have int; growing int; cost numeric; cap int;
begin
  perform 1 from public.ci_players where id = u for update;
  if not ci_private.has_business(u,'farm') then raise exception 'Buy a farm to start crop production. Free delivery contracts remain available';end if;
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
create or replace function public.ci_buy_property(p_lot text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := public.ci_me(); l public.ci_lots;
begin
  if ci_private.business_kind(p_lot)='starter' then raise exception 'Starter flats are assigned, not sold';end if;
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
