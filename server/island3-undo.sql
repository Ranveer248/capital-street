-- Undo server upgrade 3 (island3.sql): removes plots, resources, cool-downs and the auction house, and their functions.
-- Cash already spent or earned stays as it is. Nothing else is touched.
drop function if exists public.ci_plots_state(), public.ci_auction_cancel(uuid), public.ci_auction_bid(uuid, numeric),
  public.ci_auction_new(text, int, text, numeric, numeric, int), public.ci_auction_settle(), public.ci_auction_close(uuid),
  public.ci_auction_fair(public.ci_auctions), public.ci_ai_deal(int), public.ci_ai_offer(bigint, int), public.ci_res_sell(text),
  public.ci_biz(text), public.ci_plots_collect(), public.ci_plot(text, text, jsonb), public.ci_plot_take(uuid, text),
  public.ci_owns(uuid, text[]), public.ci_plot_yield(jsonb), public.ci_plot_rate(jsonb), public.ci_bld_ok(text, text),
  public.ci_bld_cost(text), public.ci_res_price(text);
drop table if exists public.ci_auctions, public.ci_cd, public.ci_res, public.ci_plots, public.ci_plot_sites;
