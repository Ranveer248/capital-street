# Server upgrade 3: what it adds, and why (written as island3.sql and APPLIED on 2026-11-07 with the owner's OK)

Plots, building, mining and the resource market work today on one device (offline). Online, the island server keeps
cash and property, so these need new server tables and functions before they can be switched on for everyone.
It was applied to the live Supabase project on 2026-11-07 after the owner said to go ahead; undo with island3-undo.sql.

## What it adds
- `ci_plots`: one row per plot (id, owner, kind, building json: kind, level, colours, interior, name, last-collected time).
- `ci_stock`: each player's stone, coal, oil, goods.
- Functions (all security definer, checking the caller owns the plot and has the cash, like island2.sql):
  `ci_buy_plot`, `ci_sell_plot`, `ci_demolish`, `ci_build`, `ci_renovate`, `ci_customise`, `ci_collect`, `ci_sell_resource`.
- Player to player trading and an auction house: `ci_auctions` (seller, item, qty, reserve, current bid, bidder, ends at)
  with `ci_list_auction`, `ci_bid`, `ci_settle` (run when someone opens the list, no scheduled job needed).
- AI buyers: prices are computed on the server from the same wobble the game shows, so nobody can fake a price.

## Why on the server
Cash and ownership must not be editable from the browser, and two players must never own the same plot.
Income is worked out from timestamps on the server so it cannot be forged either.

## Not needed
No secret keys in the game; the game only uses the publishable key it already uses.
