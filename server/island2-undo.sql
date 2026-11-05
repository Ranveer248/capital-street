-- Undo for island2.sql (Capital Island economy version 2): removes the wholesale market, the contracts, the ledger and their
-- functions. It does not touch players, cash, property, the food chain's stock or any other table.
-- After running this, run island.sql again: it puts the seven functions that island2.sql replaced (ci_state, ci_finish, ci_ship,
-- ci_grow, ci_process, ci_buy_property, ci_buy_listing) back to their earlier versions.
-- Trips of the new kinds (goods, fuel, contract) that exist stay in ci_shipments; delete them first if you want that table as it was:
--   delete from public.ci_shipments where kind in ('goods', 'fuel', 'contract');
drop trigger if exists ci_ledger on public.ci_players;
drop function if exists public.ci_ledger_trg();
drop function if exists public.ci_buy_goods(uuid, text, int);
drop function if exists public.ci_sell_goods(uuid, text, int, text);
drop function if exists public.ci_take_contract(uuid, text);
drop function if exists public.ci_board();
drop function if exists public.ci_posted(bigint, int);
drop function if exists public.ci_take_inv(uuid, text, text, int);
drop function if exists public.ci_units(public.ci_market);
drop function if exists public.ci_unit_cents(text, int, int, int);
drop function if exists public.ci_total_cents(text, int, int, int, int);
drop function if exists public.ci_what(text, int);
drop function if exists public.ci_note(text);
drop function if exists public.ci_rdiv(bigint, bigint);
drop table if exists public.ci_ops, public.ci_ledger, public.ci_contracts, public.ci_tpl, public.ci_market, public.ci_inv cascade;
