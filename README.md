# Capital Street

A trading game. You're a broke student in New York: borrow a little, trade, and work your way up to your own tower on Wall Street, then hire brokers, employees and interns, and expand.

Play it by opening `capital-street/index.html` from a web server (GitHub Pages works). It's built for high-end phones and computers.

## How we build it

One small goal at a time. Each goal has a short checklist. When it's built, we check it against the list. If it doesn't pass, we fix it or redefine the goal. No extras that aren't in the goal.

## Goal 1: the New York map ✅

The target is the two reference images: a flat world map when zoomed out (image 2), real 3D New York when zoomed in (image 1).

| Check | Result |
|---|---|
| Zoomed out matches image 2 | ✅ flat green land and blue sea in the reference colours, thick black borders, dark country names with a white halo, continent names, and New York shown as a small office-block icon with a blue badge |
| Everything except New York is locked | ✅ a light tint outside New York; tapping there shows "Locked", and you can only zoom in over New York |
| Zoomed in matches image 1 | ✅ 56,759 real building pieces from Overture Maps with real heights, setbacks and spires. Facades are drawn per style: glass window bands, stone with punched windows, brick walk-ups, all-glass towers, plus shop fronts on the ground floor. Dark roofs with light parapet rims, 11,382 rooftop plant rooms and water towers, asphalt streets, and 3,404 street names painted on the map ("John Street") |
| Start like image 1 | ✅ Play flies from the world map to the roof of 28 Liberty Street by John Street, Liberty Place and Broadway, where the student's rooftop room is: "WHERE YOU START" |
| HUD like image 1 | ✅ the player in the middle of a dock with two round buttons on each side, and a scrolling price ticker along the bottom |
| Recognisable New York | ✅ real coastline, Central Park, 45,000 real trees, parks and lakes; labels for neighbourhoods, landmarks and rivers |
| Controls | ✅ drag to move, pinch/scroll to zoom, twist/right-drag to turn; tilt opens up as you zoom in |
| High-end graphics | ✅ physically based lighting, real-time sun shadows, sky reflections in window glass, up to 3× pixel density |
| UI from Figma | ✅ [Capital Street — Game UI](https://www.figma.com/design/9PMFhcKouB5mSqsUjjD64j) (tokens, components, three screens) |

Only Manhattan has buildings for now. Brooklyn, Queens, the Bronx and New Jersey are visible but flat. The Staff and Shop buttons and the ticker prices are placeholders until later goals.

## Goal 2: city-builder foundation ✅ (replaced in goal 3)

Modelled on SimCity BuildIt's systems (see [RESEARCH.md](RESEARCH.md)), with our own names and art. Goal 3 replaced this HUD with the trading UI from the reference videos.

| Check | Result |
|---|---|
| Level system like BuildIt | ✅ level star and XP bar; XP to the next level is 40 × level^1.8; a level-up screen shows what unlocked |
| Same kinds of buildings | ✅ Build menu with 7 families (Homes, Shops, Industry, Finance, Services, Parks, Landmarks), 34 buildings, each locked until its level |
| HUD like BuildIt | ✅ level and XP top-left, population centre, cash and gold top-right, big Build button bottom-right, Market bottom-left |
| Earn XP from the start | ✅ five starter tasks (Wall Street, Build menu, the world, Central Park, the Stock Exchange) worth XP and cash; progress is saved on the device |
| Zoom out and the city turns into the world map | ✅ buildings sink smoothly into the map between 6 km and 70 km, then the world map takes over |
| Installable as an app | ✅ app manifest, icons and a service worker: "Add to Home Screen" gives a full-screen app that works offline after the first visit |
| UI from Figma | ✅ screens "04 City — builder HUD" and "05 Build menu" |

## Goal 3: the trading game, styled after the reference videos ✅

| Check | Result |
|---|---|
| The story | ✅ you live alone in a rooftop studio; rent ($1,850) is due at the end of day 3; you have $340 and find a $2,000 envelope. Pay the rent or get evicted; it comes back every 7 days |
| Paper trading simulator | ✅ 16 fictional New York companies with prices that move every game minute (market, sector and company moves); market and limit orders, positions, P&amp;L, trade history; saved on the device |
| The market opens and closes | ✅ 09:30–16:00 game time, one game minute per second (1×, 5× or 20×); nights fast-forward; "Skip to open" |
| Anything can happen | ✅ 12 kinds of surprise events, about three a day: crashes, rallies, a plane hitting a Midtown tower (with smoke you can fly to), blackouts that close the exchange, hacks and halts, rate hikes, scandals, earnings, meme squeezes, buyouts, hurricanes, sector booms and slumps |
| UI like the videos | ✅ thin dark top banner, cash/worth/rent pills, avatar dock with four small round buttons, scrolling company ticker, dark Share Exchange panel (company list with sparklines, price and stats, line/candle chart with time ranges, order book, buy/sell ticket with 25/50/75/max) |
| Buildings like the videos | ✅ 24,205 pitched tiled roofs (gables and hips) with chimneys on rectangular low-rise buildings, framed windows, cream, ochre and brick walls, green lots, beige sidewalks, asphalt with yellow centre lines, white lane dashes and 14,993 zebra crossings |
| People and traffic | ✅ ball-headed people walking the sidewalks and boxy cars driving the streets wherever you look |
| Zoom out like the videos | ✅ the city sinks into the map, then the map turns into a 3D globe with a glowing atmosphere in starry space, with countries, borders and New York marked |

## Goal 4: the bank loan ✅

| Check | Result |
|---|---|
| A bank on Wall Street | ✅ Big Apple Bank is marked on the map by Wall Street; the bank button (or tapping the marker) flies you there and opens it. The loan officer explains the starter loan the first time |
| Start small | ✅ only the $1,000 Starter Loan is open at first. Four bigger loans ($5k, $25k, $100k, $500k) unlock with a better credit score and more net worth; each shows what it needs |
| Interest and a due date | ✅ interest grows every game minute (1.2% a day at a poor score, down to 0.3% at an excellent one; a Fed rate hike makes new loans dearer); 7 to 30 day terms |
| Repay early or in parts | ✅ repay any amount (25/50/75%/all); paying on time raises your score (+45) |
| Miss it and there are consequences | ✅ on the due date the bank takes your cash and sells your shares. If that isn't enough: a 10% late fee, a higher rate, −90 score and 3 more days. Miss again: default, score 300 |
| The loan on screen | ✅ a Loan pill on the top bar shows what you owe and when (tap it to open the bank); net worth subtracts the debt; the portfolio shows the loan and your score |

## Goal 5: buy property ✅

| Check | Result |
|---|---|
| Tap any real building | ✅ any of Manhattan's buildings can be tapped (all parts of a building count as one): it turns yellow, like the reference video, and its listing opens with a photo of the building, its type, street, floors, floor area, height, price and weekly rent income |
| Browse listings | ✅ a property screen (key button in the dock) lists buildings with photos; filter by Homes, Shops, Offices or Towers and by price, show only what's in view, sort by cheapest or biggest |
| Your first office on Wall Street | ✅ the listings open with the goal: the cheapest office floor in a building on Wall Street. Buy a single floor of a tower, or a whole building (5% off). Owning an office on Wall Street triggers a milestone |
| Yours on the map | ✅ owned buildings are tinted green with a "YOURS" marker (or "YOURS · 3/47 floors"); tap it to open the listing |
| Rent and prices | ✅ tenants pay rent every night (about 2.8% of the value a week); prices follow a New York property index that drifts daily and falls in crashes, plane crashes, hurricanes, blackouts and rate hikes |
| Sell, and it counts | ✅ sell a floor or everything (6% fee); property counts toward net worth and shows in the portfolio. If rent or a loan can't be paid, shares are sold first, then property |

## Goal 6: your office and staff ✅

| Check | Result |
|---|---|
| Your office, roof off | ✅ the first office floor you buy becomes your office (or pick any building you own: "Make this my office"). The briefcase button, or "Enter your office" on its listing, looks straight down into the top floor: the roof, rooftop machinery and any tiled roof are lifted off, leaving a wooden floor inside the building's real outline |
| Furnish it | ✅ 13 items in 4 groups (desks, trading desks, meeting tables, plants, coffee machine, water cooler, sofas, ping-pong, rugs, bookshelves, walls, server racks, news screens), placed by tapping a grid on the floor; rotate, or remove for half back. Furniture counts toward net worth at half its price |
| Hire staff | ✅ every day new interns, employees and brokers apply, each with a name, skill stars, a salary and a hiring fee. Everyone needs a desk; brokers need a trading desk. They sit at their desks as round-headed people, like the reference videos |
| They earn (or lose) money | ✅ every night: interns and employees bring in office income; brokers trade for you, riding the day's market, with the odd monster day or disaster day; salaries are paid. A nightly report shows the profit or loss |
| Vibe | ✅ plants, coffee, sofas, ping-pong and more raise the office vibe (30 to 100), which sets how fast people work (60% to 140%). A gloomy office makes people quit |
| Promotions and surprises | ✅ interns can be promoted to employees after 5 days, employees to brokers after 10; staff you can't pay quit; selling the building closes the office |

## Goal 7: more cities ✅

| Check | Result |
|---|---|
| Cities on the globe | ✅ New York, London, Tokyo, Hong Kong and Dubai have markers on the zoomed-out map and globe: ● where you are, ✓ open, 🔒 locked. Tap one for its card |
| Unlock with money | ✅ each city needs a net worth and an opening fee in cash: London $150k / $20k, Tokyo $500k / $60k, Hong Kong $1.2M / $150k, Dubai $3M / $350k. The card shows your progress |
| Real streets and buildings | ✅ every city is baked from Overture Maps like New York: its own buildings, roads, parks, water and coastline, with its own districts and landmarks labelled |
| Travel | ✅ "Fly to …" zooms out to the globe and flies you into the new city; the house button flies you home to New York. Cash, shares, loans, buildings and staff go with you |
| Its own companies | ✅ 4 companies per city (16 more in all) join your Share Exchange when you open a branch; until then they can't be traded |
| Its own property | ✅ buildings in every city can be bought, rented out and sold, and any of them can become your office |

## Goal 8: the app ✅ (store upload waits on your developer accounts)

| Check | Result |
|---|---|
| Works offline | ✅ three.js and the fonts are now inside the game (`lib/`, `fonts/`) instead of loaded from the internet. Tested with every outside request blocked: the game loads with no errors |
| Android app | ✅ `capital-street-app/` wraps the game with Capacitor. GitHub Actions builds an installable APK on every change (first run: 17.5 MB, all five cities inside) |
| iPhone app | ✅ the Xcode project builds on GitHub's Mac runner (Xcode 26.6, passes Apple's store validation step) |
| Feels like an app | ✅ own icon and splash screen, portrait only, no status bar, Android back button closes the open panel, the game saves when you leave the app |
| Store ready | ✅ privacy policy (`privacy.html`), store listing text, and the signing and upload steps are wired into the build. They switch on once you add your Google Play and Apple keys as GitHub secrets: see `capital-street-app/README.md` |

## Goal 9: buildings that look like where they're built ✅

From the first new reference video ("every building looks like the place it's built in").

| Check | Result |
|---|---|
| Every building has a type | ✅ house, terraced house, apartments, shop, office, tower, factory or landmark, worked out from the map's own tags, the 550,000 real places in the five cities (shops, restaurants, offices, factories, churches, schools) that fall inside each building and the building's size and shape. New York: 1,415 houses, 23,914 terraced and walk-up buildings, 15,945 apartment buildings, 4,500 office buildings, 468 factories, 2,387 landmarks |
| 12 materials | ✅ red brick, brownstone, yellow brick, grey stone, limestone, white stucco, painted plaster, timber frame, concrete, glass, wood siding and ribbed metal. Up close the shader draws brick courses, stone blocks, oak beams, boards and ribs |
| Each type looks different | ✅ houses get front doors and small framed windows, terraces tall narrow windows, offices window bands, towers glass or stone piers, landmarks tall arched windows, factories a strip of high windows and loading doors, shops display windows under coloured or striped awnings |
| Each city has its own style | ✅ New York brownstones, brick walk-ups and water towers; London yellow-brick and white-stucco terraces under slate with rows of chimneys; Tokyo concrete and plaster with dark tile and blue metal roofs; Hong Kong concrete towers; Dubai sandstone and white stucco with domes |
| Attics, chimneys, solar panels | ✅ pitched roofs get attic dormers along both slopes and an attic window in each gable; chimneys on the ridge; solar panels on sunny slopes and in rows on flat roofs |
| Domes, spires, battlements | ✅ domes with a drum and lantern (copper, gold or stone) on churches, mosques, civic buildings and some towers; spires on churches; castle battlements on old stone landmarks. New York: 328 domes, 362 spires, 201 battlemented roofs |
| Factories | ✅ sawtooth roofs with rows of north-light windows on big factories and warehouses (129 in New York, 148 in London) |
| No frame-rate loss | ✅ by draw calls and triangles, measured at the same views before and after: city view 605 draw calls and 4.5M triangles (before: 509 and 4.1M), street view 591 and 7.7M (before: 1,642 and 7.8M). All rooftop things and crowns are now drawn in one batch per kind, and crowns hide before the city sinks into the map. Frame times on this cloud machine's software renderer swing by ±50% between runs, so the heavier facade shader still needs a look on a real PC |

## Goal 10: PC-first, smooth, and a proper main menu ✅

Designed first in Figma ([Capital Street — PC UI](https://www.figma.com/design/U7FfBzmGHr4QYbCReSROtb)): colour, spacing and radius tokens, reusable components (buttons, menu items, stat chips, dock buttons, key caps, toggles, segmented controls) and four 1920×1080 screens: main menu, in-game HUD, settings and pause. Dark glass panels over the city, one green accent, and the keyboard shortcut shown next to everything, like current PC simulators.

| Check | Result |
|---|---|
| Main menu | ✅ a left column (title, Play or Continue with your day, city and net worth, New game, World, Settings, Credits) over the city turning slowly behind it; on PC a "Your empire" card and the market status; arrow keys, Enter and each item's letter work; New game asks twice before erasing a save |
| PC layout | ✅ clock bar top left, money chips top centre, settings and pause buttons top right, a labelled dock with each key (B, X, H, P, O, M), panels docked on the right so the city stays in view, and the dock slides into the visible part of the city |
| Mouse and keyboard | ✅ W A S D or arrows move, Q E turn, R F zoom, Shift goes faster, Space pauses time, 1 2 3 set the speed, Esc closes a panel or opens the pause menu, F10 settings, F3 frame rate, ? lists every key |
| Pause menu | ✅ Resume, Settings, World map, Save and quit to menu; time stops while it's open, and in the main menu |
| Graphics settings | ✅ presets (Low, Medium, High, Ultra), resolution scale, frame-rate limit (30, 60, 120, Max), sun shadows (Off, Low, High), anti-aliasing, building detail, frame-rate counter; saved on the device |
| Smooth | ✅ "Keep 60 fps automatically" lowers the resolution 10% after 2 slow seconds and raises it again after 5 smooth ones (tested: on this slow cloud machine it stepped down by itself) |
| Phones still work | ✅ the same menu as a stack with a big green Play, a pause button in the clock bar, no key hints on touch screens |

## Goal 12: bright, smooth, with levels ✅

Designed first in Figma ([Capital Street — Bright UI](https://www.figma.com/design/IVnAL3NQiLgUSkZrrZrFLk)): Traffic Rush's vivid palette (22 colour tokens) and the layout city simulators use (level star and XP bar top left, money pills top right, a dock of round coloured buttons, ribbon pop-ups), as components plus an in-game HUD and a level-up screen. Our own art and layout; nothing copied from any game.

| Check | Result |
|---|---|
| Vibrant colours like Traffic Rush | ✅ royal-blue panels with a thick dark outline, a coloured header ribbon per panel (exchange blue, bank gold, property orange, online pink, staff purple), chunky gradient buttons on a solid lip, gold and green accents, blue-to-purple menu and loading screens |
| Like a city simulator | ✅ level star with an XP bar top left, money pills top right, round coloured dock buttons (bank gold, exchange blue, property orange, office purple, world green) |
| Levels | ✅ XP for trades, rent paid, property bought, rent coming in, loans repaid, staff reports, new cities and every trading day; XP to the next level is 40 × level^1.8; 13 titles from Student to Wall Street Legend; "+XP" floats up from the star |
| Level-up screen | ✅ turning rays, the star spins in, three rewards pop in one by one, COLLECT pays a level bonus that grows slowly (+$75 at level 2, about +$1,000 at level 10) so the economy doesn't inflate. Saved with the game and the cloud save |
| Smoother UI | ✅ panels spring in from the side, cards pop, rows fade up one after another, the dock and top bar slide in, buttons press down onto their lip, the money pills bump and glow green or red when cash changes. Respects "reduce motion" |
| Smoother map | ✅ the mouse wheel eases the camera to the new height (in log space, so it feels the same at street level and over the globe) instead of jumping a step per click; the camera glides a little longer after a drag |
| Brighter graphics | ✅ a bluer sky, more fill light and a touch more exposure in the city |
| Phones and PCs | ✅ checked at 375 × 812, 1024 × 768 and 1280 × 800 with no overlaps |

## Goal 13: real land and a property market ✅

| Check | Result |
|---|---|
| Land plots on the map | ✅ the open land around each city is cut into 160 m plots (5,346 around New York, in Queens, Brooklyn, the Bronx and New Jersey), found by painting the city's land onto a small canvas and keeping squares that are land all the way across. Thin white outlines fade in as you zoom out; tap a plot for its card (size, price per m², lease, distance from Wall Street) |
| Buy, own and sell land | ✅ plots cost about $9k to $51k, dearer near the centre, and follow the property market; owned plots turn green, earn a farmer's lease every night (0.2% of value) and count toward net worth; selling costs 6%. In multiplayer they are claimed through the same server rules as buildings (key `plot:i:j`), so other players' land shows in blue. No database change was needed |
| A Zillow-style market | ✅ the property screen has For sale, Deals, Auctions, Land and Yours tabs, with listing photos, filters and sorting (biggest discount, cheapest, most valuable, nearest). Every morning motivated sellers list 36 buildings and 14 plots 6–28% below value; the listing card shows the deal price next to the crossed-out value |
| Auctions with max bids | ✅ three new lots every morning at 09:00 (two buildings and a plot), each closing at 15:00 the next day. You set a maximum and the game bids for you; 2–5 other bidders join over time, each with a hidden maximum; the winner pays one step (about 1%) above the second-highest maximum. Win and it's yours at that price; lose and you see what it went for |
| Everything for sale lights up | ✅ deals glow gold and auctions purple on the map, with price tags (`$137k −15%`, `AUCTION · $24k`) you can tap; plots for sale are filled gold or purple too. One switch in the property screen turns it all off |

Deals and auctions are worked out from the city and the day, so the save only keeps your bids. Buying from other players (and auctions between players) needs new server tables: that is the next step for this goal's multiplayer side.

## Goal 14: businesses on your land ✅

| Check | Result |
|---|---|
| Farms, mines, oil wells and shops | ✅ build one business on any plot you own: a farm ($6,000), an iron mine ($28,000, needs an ore deposit: about 1 plot in 6), an oil well ($70,000, needs an oil field: about 1 in 12) or a shop ($15,000, needs to be within 5.5 km of the centre). Each plot's card shows its soil, ore, oil and how close town is |
| On the map | ✅ farms get crop rows, a red barn and a silo; mines a pit, a headframe and ore heaps; oil wells nodding pumpjacks and a tank; shops a store with a pink awning. Each upgrade adds to them |
| Setup cost and effort | ✅ every night each business pays its upkeep (no cash, no work that night) and fills its storage, which holds three days' output: you have to come back and collect. Three levels (upgrades cost 1.5× then 2.2× the build price, for 1.6× and 2.5× the output). Demolishing gives back 30% |
| Income without inflating the economy | ✅ goods sell to the city's buyers at a price that walks down with every unit sold (the city buys about 600 crates, 400 t of ore or 250 barrels a day before the price halves) and recovers overnight. A farm pays back in about a month, a mine or well in three to four weeks if you keep collecting |
| A first production chain | ✅ shops sell crates from your warehouse at $18 instead of the city's ~$10, up to 40 a night per level, so farms and shops work together |
| Business tab | ✅ Property → Business: your warehouse with live prices and Sell ¼ / Sell all (showing what you'll get), every business with its storage, and Collect everything |
| Fits the rest of the game | ✅ XP for building, upgrading and selling; hurricanes flatten crops; crashes and rate hikes knock the oil price; businesses count toward net worth (a third of what went in, plus goods at today's price); a plot with a business stops collecting the farmer's lease; selling the plot sells the business with it |

## Goal 15: markets and production chains ✅

| Check | Result |
|---|---|
| Production chains from raw to finished goods | ✅ four factories to build on your land: a food factory (4 crates → a box of packaged food), a steel mill (3 t ore → 1 t steel), a refinery (2 barrels crude → a drum of fuel) and machine works (2 t steel + a drum of fuel → a machine, worth about $1,500). Every night they take what they need from your warehouse, in chain order, so a machine can be built from ore dug the same night |
| You set the price | ✅ list any goods in your warehouse at your own price: the city's buyers take some each night, more the further below their price you ask and nothing above 1.3× it; take a listing back at any time. Or sell straight away at the going price, which drops as you sell |
| A factory planner | ✅ Property → Business: pick a product and how many a day; it walks the chain down to farms, mines and wells and shows how many of each to build, the cost, the upkeep, what it sells for at today's price and how long it takes to pay back |
| On the map | ✅ factories are halls with chimneys (white towers for refineries) and crates in the yard; upgrades add chimneys |
| An exchange between players | ✅ Property → Business → Player exchange: an order book for every good where players set every price. An order trades at once with any waiting order at your price or better (at that order's price) and the rest waits; selling holds the goods and buying holds the cash until it trades or you cancel; the other player's cash or goods arrive in their game even if they're away |
| Selling property to players | ✅ list any building or plot you own at your price, or auction it to players for 6 hours, a day or 3 days (real time). Buyers see a "Buy from …" button on its card and a From other players list in Deals; player auctions sit above the city's in Auctions. The server bids for you up to your hidden maximum, the winner pays one step above the second-highest maximum, and a bid in the last two minutes extends the auction |

### How trading works on the server

Five tables and nine checked functions in [`server/schema.sql`](server/schema.sql), applied to the Capital Street project and tested on it (inside a rolled-back transaction) with three made-up players: nobody can list, sell or auction what they don't own; a changed price is refused; nobody sees another player's maximum bid; an auction settles once; inboxes are private.

- `cs_inbox`: money and goods owed to each player; their game collects it at sign-in, or at once while online.
- `cs_listings`: buildings and plots for sale to players at a fixed price.
- `cs_pauctions` and `cs_pbids`: auctions between players and the hidden maximum bids.
- `cs_orders`: the goods exchange's order book.

Cash still lives in each player's own save, so a player who edits their save could promise money they don't have; moving cash to the server is the cheat-proof next step.

## Goal 16: inside buildings ✅ (renting rooms to players waits on the server)

| Check | Result |
|---|---|
| Rooms and tenants | ✅ every building you own (other than your office) has two rooms a floor, let to tenants with names; its card shows how many are let, who lives there, how happy they are and what the building makes tonight. Tenants move in and out each night towards how good the rooms are |
| Furniture and fit-outs | ✅ Basic, Nice (+15% rent) or Luxury (+35% rent) rooms, priced by the building's size and value; nicer rooms keep tenants too. Your office keeps its own furniture, now with an air conditioner |
| Extensions and basements | ✅ add up to three floors on top (two more rooms each, counted in the building's value) and dig a parking basement that pays every night |
| Temperature | ✅ a 28-day year from a cold winter (about −2°C) to summer heatwaves (about 30°C), shown in the top bar. Without heating, winter empties rooms; without cooling, so does a heatwave; heating and cooling cost a little each night to run. In your office, server racks, news screens and hot days make heat that lowers the vibe unless air conditioners take it away, and a cold office is gloomy too |
| Renting rooms to players | ⬜ needs new server tables (rooms on offer, leases, rent paid between players). Waiting on the owner |

## Goal 17: your own company on the stock market ✅ (players trading its shares waits on the server)

| Check | Result |
|---|---|
| Start a company | ✅ Property → Business → Your company: once your net worth reaches $250,000, pick a name and a 3–4 letter ticker and found it ($25,000). Its book value is your buildings, land, businesses and goods, split into shares so it lists at about $20 |
| Take it public | ✅ while the market is open, sell 20%, 30% or 40% to investors at 10% over book (the bankers keep 3%). Its ticker then trades every minute on the Share Exchange next to the fictional companies, with charts, news and surprise events |
| A price that follows your empire | ✅ every night investors reprice it towards its book value plus 20 times what the empire grew; buy shares back on the exchange to own more of it, sell yours to raise cash. The part investors own counts against your net worth, so going public never counts the same buildings twice |
| Players trading its shares | ⬜ needs the exchange's order book to accept company shares as well as goods (a server change). Waiting on the owner |

## Goal 18: logistics ✅

| Check | Result |
|---|---|
| Ports | ✅ a new business ($40,000) for waterfront plots (plots at the edge of the land): a quay with a crane and stacks of containers, more with each level |
| Ships between cities | ✅ Property → Business → Logistics: send goods from your warehouse to any other city you've opened. Each city pays its own prices (Tokyo +30% for ore, Dubai +40% for crates and +35% for machines, London +20% for produce, Hong Kong +30% for machines…). Ships cost about 2% plus a little per km and take about a game day per 6,000 km (New York → Tokyo: 10,843 km, 1.8 days); they need a port of yours in the city they leave from. The form shows what it will fetch there, the shipping cost and what you'd get selling at home |
| Air freight | ✅ the same without a port, about ten times faster and five times dearer: worth it for machines, not for ore |
| On the map | ✅ your ships sail out of your port and away to sea, and incoming ones sail in |
| Trucks | ✅ hire a truck fleet per city ($40 a night for each farm, mine or well) and it picks up their storage every night, so you don't have to collect by hand |
| Fits the economy | ✅ each city's price drops as you sell there and recovers overnight; goods at sea still count toward net worth |

## Goal 19: wiki, changelog and community ✅ (outside channels wait on the owner)

| Check | Result |
|---|---|
| Wiki | ✅ [wiki.html](wiki.html): getting started, trading, the bank, property, deals and auctions, land, businesses, factories and the planner, logistics, inside buildings, the office, your company, playing and trading online, levels, PC keys and community rules, in the bright style |
| Changelog | ✅ [changelog.html](changelog.html): what's new, newest first |
| Linked from the game | ✅ Wiki and What's new sit next to Terms, Privacy and Credits in the main menu and the pause menu |
| Community | ✅ in-game chat (World and each city) with the fair-play rules from the Terms. ⬜ A Discord server or social accounts need the owner to create them |

## Goal 20: launch on PC (builds ✅, store pages and big hosting wait on the owner's accounts)

| Check | Result |
|---|---|
| A desktop download | ✅ `capital-street-desktop/` wraps the game with Electron for Windows, Mac and Linux. It serves the game from inside the app (an `app://` address, since the map data is loaded with fetch), so it plays offline and online exactly like the website; F11 toggles full screen. Checked on Windows: it opens and the city loads |
| Built automatically | ✅ GitHub Actions builds every platform on each change: a Windows .exe that runs without installing (and a .zip), a Mac .zip and a Linux AppImage and .tar.gz, as downloads on the run. The Linux build also starts the game and fails if the city doesn't load |
| itch.io | ✅ ready: add the `BUTLER_API_KEY` secret and the `ITCH_GAME` variable and every build is pushed to itch.io (steps in `capital-street-desktop/README.md`). ⬜ Needs the owner's itch.io account |
| Steam | ⬜ needs a Steamworks account ($100 per game) for an App ID; the builds are ready to upload with SteamPipe. Code-signing certificates would remove the "unknown publisher" warnings on Windows and Mac |
| Hosting for a game of any size | ⬜ the plan is under Hosting below (the game on Cloudflare Pages, map data on Cloudflare R2 as cities stream in); it needs the owner's Cloudflare account. GitHub Pages carries the game fine at its current size (about 17 MB) |

## Goal 21: high-end graphics ✅

| Check | Result |
|---|---|
| A film finish | ✅ `js/gfx.js` draws every frame in high dynamic range, then adds glow on bright things (bloom), filmic tone mapping, colour grading (cool shadows, warm highlights, a gentle S-curve), a vignette and fine dithering |
| A sun that follows the clock | ✅ mornings are pale, evenings golden, nights dark blue with stars and a moon; sunlight, shadows, sky, haze and reflections all follow it. The menu is always at golden hour |
| Sky and clouds | ✅ drifting clouds lit by the sun, a sun disc and glow, baked into the reflections whenever the light changes |
| Glass towers and city lights | ✅ windows reflect the sky like glass; at night a scattering of windows lights up warm or cool, and streets glow |
| Water | ✅ the sea, rivers and lakes have moving waves, sky reflections and the sun's glitter |
| Ground and haze | ✅ grass and parks vary in colour; distance fades into the colour of the horizon |
| High-end devices first | ✅ phones and computers that are likely too slow (weak graphics chips, little memory, no WebGL 2, or under 24 fps for 20 seconds) get a warning once; the graphics aren't lowered for them |

## Goal 22: a simpler game: menu, online play, clean screen, tutorial ✅

| Check | Result |
|---|---|
| New main menu | ✅ like a mobile city game: the logo over the city at golden hour, your player card, your empire in four chips, one big PLAY button and round buttons for World, How to play, Settings, Credits and New game |
| Online only | ✅ Play takes you into the shared world: the first time you pick a name and a colour and play as a guest (an email can be added later). Only if the server can't be reached can you play offline for now |
| A clean map | ✅ zoomed out, you only see your apartment and your own buildings and land. Deals, auctions, other players, plot outlines and price tags show while you browse property, or up close |
| A simpler screen | ✅ the share ticker, key hints and empty loan pill are gone; rent shows when it's due within a day and a half |
| Cleaner trading | ✅ a wider exchange without the order book, four key numbers, a bigger price; property filters fit on three short rows; breaking news no longer covers the panels |
| Tutorial | ✅ Penny the piggy bank shows new players around in ten short steps, lighting up the one thing to tap: money, rent, buying a share, selling, buildings and the news. "How to play" shows it again |

## Goal 23: surprises ✅

| Check | Result |
|---|---|
| More events | ✅ bull runs, flash crashes that bounce back, recession fears, tax cuts, oil shocks, a tech bubble bursting, AI breakthroughs, bank runs, tourist booms, mystery buyers and product recalls, about four surprises a day |
| Planes | ✅ airliners cross the sky with blinking lights about once a minute |
| Plane crashes | ✅ the rare crash in the news is shown: an airliner with a failed engine comes down into a tower, with a fireball, a flash and smoke. Very rarely it is one of your buildings: you pay a share of the repairs and the whole market crashes again |

## Goal 24: easier to play, a livelier city ✅

Menus modelled on the city builders (SimCity BuildIt, Clash of Clans, Hay Day): one bar of big labelled buttons at the bottom, the main money button in the bottom-right corner, small round buttons down the side.

| Check | Result |
|---|---|
| One game bar everywhere | ✅ the bar in the game (Bank, Exchange, Home, Property, Office, World) is now also on the main menu; each button takes you in and straight there. Every button has a label, on phones too |
| Earn button | ✅ a gold EARN button opens every way to make money in one place: shares, buildings, deals, auctions, land, businesses, shipping, your own company, the office, the bank, your property and the news |
| No slow-device warning | ✅ removed |
| Easier trading | ✅ pick an amount (00, k, 0k, 00k or All) and tap one big BUY or SELL ALL; when the market is closed the order waits for the open. "More options" still has limit orders |
| Fewer crashes | ✅ about two or three surprises a day instead of four, market crashes three times rarer and about half as deep, and more good news than bad |
| Real city life | ✅ cars switch on head and tail lights at night and can be seen from further out; the Staten Island ferry, harbour tour boats, river boats and a container ship sail their real routes; a tour helicopter flies up the Hudson and a news helicopter circles the city; planes come every 15-40 seconds, on the menu too |
| Bigger map | not yet: the map is all of Manhattan; adding Brooklyn, Queens and Jersey City needs the map data rebuilt and makes the download about twice as big |

## Goal 25: a city builder in a real city ✅

The sunny, toy-like style of the mobile city builders, on real cities: you don't make land, you buy what's there, knock it down and build something new. Our own art and icons throughout.

| Check | Result |
|---|---|
| Bright and light | ✅ always a sunny afternoon, bright clean colours, light roofs, no bloom and smaller shadow maps, so it runs smoothly on phones. No slow-device warning anywhere |
| Rebuild | ✅ own a whole building, tap Rebuild: pick one of 8 designs (cottage, corner shop, townhouses, apartments, offices, glass tower, skyscraper, factory) and a colour. The old building is knocked down, a construction site with a crane goes up over a few game hours to days, then the new building stands there with its own floors, value and rent. Bigger designs need bigger plots. You pay for what the new building adds |
| Jobs | ✅ the JOBS button lists 12 jobs: trader, landlord, developer, auctioneer, bargain hunter, farmer, miner, shopkeeper, shipper, merchant, boss and tycoon. Pay is balanced: rent 0.8% a day (was 0.4%), land 0.6% (was 0.2%), farms, mines and oil wells produce a quarter less |
| Online only | ✅ no offline game: if the server can't be reached, Try again |
| Our own icons | ✅ 52 hand-drawn icons and Penny the piggy bank as SVG (js/icons.js), replacing every emoji; also in Figma on the "Icons" page of Capital Street — Game UI |
| Tutorial | ✅ Penny shows the money, rent, Jobs, Property, rebuilding, auctions to players, the Exchange and the news |
| Other players see rebuilds | ✅ each design is stored on the server (cs_buildings.design, set only by the owner through cs_set_design), so every player sees what you built, and it stays with the building when you sell it to another player |

## Goal 26: a city-builder screen and lobby ✅

Designed first in Figma ([Capital Street — Game UI](https://www.figma.com/design/9PMFhcKouB5mSqsUjjD64j), page "Goal 26 · SimCity-style redesign": components, a phone lobby and the in-game screen), then built. Laid out the way city builders do it: level and stats top-left, money top-right, the main button in the bottom-right corner, big labelled buttons.

| Check | Result |
|---|---|
| New controls | ✅ the old centred dock with the avatar is gone. Exchange and Property are big tiles bottom-left, JOBS is a big orange button in the bottom-right corner, and Home, Bank, Office and World are a rail of round buttons up the right |
| Tactile buttons | ✅ gradient faces, a gloss on top, a navy outline and a solid lip underneath, chunky Lilita One type with an outline |
| Top of the screen | ✅ level badge top-left, cash (with a + that opens Jobs) and net worth as pills with icons top-right, the clock and market under the level |
| Lobby | ✅ the menu sits over the live city instead of the globe: a logo plaque with a ribbon, cards for today's deals, live auctions and your buildings (tap to go there), round buttons for World, How to play, Settings, Credits and New game, a big green Play, and the same tiles and JOBS button as in the game |
| Camera | ✅ a narrow lens and a fixed tilt in the city, for the flatter near-isometric look of city builders instead of a low, very 3D view |
| Play always starts | ✅ tapping Play while still connecting now always starts the game once you're online |

## Goal 27: toy-city buildings ✅

| Check | Result |
|---|---|
| Coloured roofs | ✅ every building gets its own roof colour (terracotta, teal, sand, blue or slate) inside a white parapet, like a toy city |
| Windows | ✅ windows stay crisp further out, with brighter blue glass |

## Goal 28: daily tasks ✅

| Check | Result |
|---|---|
| Three a day | ✅ one easy task and two others, picked each game day from 12 (buy shares, 3 trades, sell shares, buy a building, bid at an auction, buy land, collect from a business, sell goods, build a business, ship goods, start a new building, hire staff), so they lead you through every job |
| Rewards | ✅ each pays 0.5% of your net worth ($300 to $20,000) and 25 XP; all three pay a double bonus and 60 XP |
| Where | ✅ at the top of the Jobs sheet with Go and Collect buttons, a red badge on the JOBS button when a reward is waiting, and a Tasks card in the lobby |

## Goal 29: an illustrated city ✅

Learned from the look of illustrated city builders (CityRT, SimCity BuildIt, Cities: Skylines): drawn, not realistic.

| Check | Result |
|---|---|
| Ink outlines | ✅ every building, roof line, tree, car and kerb gets a dark drawn edge, found from the depth of the picture (where 1/depth bends). The lines fade out as you zoom out so the city doesn't turn grey with ink |
| Smoothing | ✅ FXAA smooths edges instead of multisampling (a depth picture needs a plain target) |
| Warmer palette | ✅ less neon colour, warm light and soft cool shade, neutral dark asphalt so the white road markings stand out, softer grey-blue glass |
| Building fronts | ✅ a sill under every framed window, and painted shutters (green, teal or brown) on about half the houses and apartment blocks |
| Calmer streets | ✅ 1,500 cars round the camera instead of 2,400, so junctions don't clog |
| Setting | ✅ Settings → Graphics → Ink outlines, for slower devices |

## Roadmap

1. ✅ The New York map
2. ✅ City-builder foundation (since replaced by the trading UI from the reference videos)
3. ✅ The trading game and the reference style
4. ✅ Bank loan
5. ✅ Buy property
6. ✅ Your office and staff
7. ✅ More cities
8. ✅ The app (Android and iPhone builds; publishing needs your store accounts)

### Phase 2: a player-run world, on PC, multiplayer

From the 5 new reference videos (a player-run economy game on the real world map). We build the same kind of game, better, one goal at a time, with our own name, art and code (see Legal below).

9. ✅ **Buildings that look like where they're built:** house, terrace, apartments, shop, office, tower, factory, church; each city's own style; 12 facade materials; attics, chimneys, solar panels, domes, battlements, sawtooth factory roofs, shopfronts
10. ✅ **PC-first and smooth:** a perfect main menu and HUD designed in Figma from trending simulator UIs, mouse and keyboard controls, graphics settings, 60 fps
11. ✅ **Multiplayer:** accounts and one shared world; everyone sees who owns what; chat; cloud saves (your cash, shares, loans, buildings and office follow your account to every device)
12. ✅ **Bright, smooth, with levels:** a vivid simulator-style UI designed in Figma, spring animations everywhere, smooth zoom, brighter daylight, XP and levels with a level-up screen
13. ✅ **Real land and buildings for everyone:** land plots on the map; a Zillow-style property market with photos, filters and auctions with max bids; everything for sale lights up
14. ✅ **Businesses:** farms, mines, oil rigs and shops on your land; NPC income that rewards setup cost and effort without inflating the economy
15. ✅ **Player-set markets:** an item exchange where players set every price; production chains from raw resources to finished goods; a factory planner
16. ✅ **Inside buildings:** rooms, furniture, renting rooms to players and NPCs, extensions and basements, temperature (heat from machines, cooling, happy tenants and workers)
17. ✅ **Companies and the stock market:** start a company, take it public, players trade its shares
18. ✅ **Logistics:** ports, ships and trucks moving goods between cities
19. ✅ **Wiki, changelog and community**
20. ✅ **Launch on PC:** hosting for a game of any size, then a desktop download (Steam / itch.io)
21. ✅ **High-end graphics:** bloom, grading, a sun that follows the clock, clouds, glass, water, night lights
22. ✅ **Simpler:** a new menu, online-only play, a clean map and screen, a tutorial
23. ✅ **Surprises:** more market events, planes in the sky, plane crashes
29. ✅ **Illustrated city:** ink outlines, a warmer palette, window sills and shutters
28. ✅ **Daily tasks:** three a day across every job, with rewards and a bonus
27. ✅ **Toy-city buildings:** coloured roofs, crisper windows
26. ✅ **City-builder screen:** designed in Figma; corner JOBS button, tiles and a rail instead of the dock, a lobby over the city, a flatter camera
25. ✅ **City builder:** a bright toy-city look, rebuild what you own, 12 balanced jobs, online only, our own icons
24. ✅ **Easier, livelier:** one game bar in and out of the game, an Earn button, simple trading, fewer crashes, boats, helicopters and car lights

## Legal

Not legal advice: have a lawyer read these before a paid launch.

- [Terms of Service](terms.html): game money has no real value, no real-money trading, nothing is financial advice, real places appear only as a map and their owners aren't connected to the game, fair-play and chat rules, the game is our own work and not connected to any other game, takedown contact.
- [Privacy Policy](privacy.html): playing alone collects nothing; playing online keeps only a player name, owned buildings, chat, reported net worth and (optionally) an email, on Supabase as our processor; delete-my-account in the game removes it all; age rules match the Terms.
- [Credits](credits.html): every outside source and its licence (OpenStreetMap ODbL attribution, Overture, Natural Earth, three.js MIT, supabase-js MIT, fonts OFL, Capacitor MIT).
- Linked from the title screen.
- How we avoid copying the reference game: we build the same *kind* of game (game ideas and mechanics can't be owned), but never use its name, logo, art, text, UI layouts or code. Our name, buildings, characters, companies and UI are our own. Real company names and logos stay out of the game.

## Turning on multiplayer

Online play needs a free [Supabase](https://supabase.com) project. Until one is set, the game plays alone exactly as before and the menu says "Solo".

1. Create a project (free plan is fine), open **SQL Editor**, paste all of [`server/schema.sql`](server/schema.sql) and run it. It is safe to run again after updates.
2. **Authentication → Sign In / Providers:** turn on **Allow anonymous sign-ins** (for "Play online as a guest") and keep **Email** on. Optional: turn off "Confirm email" while testing.
3. **Project Settings → API Keys:** copy the project URL and the **publishable** key (`sb_publishable_...`, or the legacy `anon` key) into [`js/net-config.js`](js/net-config.js). Never put the `service_role` / secret key in the game: everything in it is public.
4. Reload the game. The chip next to your cash turns into "Sign in"; press **O** in the menu or **T** in the game.

Cloud saves: once you have a player, your game is saved to your account (table `cs_saves`, one row per player, only you can read or write it) every minute, when you buy or sell, and when you leave the page. On a device that last saw an older copy, the newer cloud copy loads and the old local save is kept as a backup (`capital-street-market-v1-backup`).

Who may change what is enforced by the database itself (row-level security plus two checked functions), not by the game, so a modified game can't take someone else's building, post as someone else or rename them.


## Hosting

The game is a static website, so it can be hosted anywhere that serves files:

- **GitHub Pages (free, live):** this repo, `Ranveer248/capital-street`, is published from `main` / root at **https://ranveer248.github.io/capital-street/** (Settings → Pages). Every push to `main` updates it in about a minute.
- **Elsewhere:** Netlify or Cloudflare Pages work too: point them at this repo, no build step.
- **As an app:** open the site on a phone and choose "Add to Home Screen". It installs full-screen with its own icon.
- **When it gets big (more cities, the whole world):** GitHub refuses single files over 100 MB and slows down past a few GB. Plan: the game itself on **Cloudflare Pages** (free; files up to 25 MB, 20,000 files) and the big map data on **Cloudflare R2** (10 GB free, then $0.015 per GB a month, and no fee for players downloading it). Cities stream in as you visit them, so a multi-gigabyte world never has to download at once.
- **On PC as a download:** built automatically from `capital-street-desktop/` (Goal 20). **Steam** ($100 per game, paid back once the game makes $1,000) or **itch.io** (free; downloads up to 1 GB per file). The same files run in a desktop window.
- **App Store / Google Play:** done with Capacitor in `capital-street-app/`. GitHub Actions builds the apps; publishing needs an Apple developer account ($99 a year) and a Google Play account ($25 once). Step-by-step: `capital-street-app/README.md`.

## Map data

`data/` is baked by `tools/build_map.py` and is checked in, so the game needs no build step.

To rebuild it:

```sh
pip install pyarrow shapely requests numpy
cd tools
RAW=/some/scratch/dir
# Overture Maps (release 2026-10-21.0), read straight from its public S3 bucket
python3 grab.py buildings building      -74.03 40.69 -73.90 40.885 $RAW/nyc-building.parquet id,geometry,bbox,height,num_floors,min_height,min_floor,roof_shape,roof_height,class,names,facade_color,roof_color,facade_material,roof_material
python3 grab.py buildings building_part -74.03 40.69 -73.90 40.885 $RAW/nyc-building_part.parquet id,geometry,bbox,height,num_floors,min_height,min_floor,roof_shape,roof_height,names,building_id,facade_color,roof_color,facade_material,roof_material
# shops, offices, factories, churches...: used to tell what each building is
python3 grab.py places place -74.03 40.69 -73.90 40.885 $RAW/nyc-places.parquet id,geometry,bbox,categories,basic_category,taxonomy,names,confidence
python3 grab.py divisions division_area -74.40 40.40 -73.50 41.10 $RAW/region-areas.parquet id,geometry,bbox,subtype,class,names
python3 grab.py base land     -74.40 40.40 -73.50 41.10 $RAW/region-land.parquet id,geometry,bbox,subtype,class
python3 grab.py base water    -74.40 40.40 -73.50 41.10 $RAW/region-water.parquet id,geometry,bbox,subtype,class
python3 grab.py base land_use -74.03 40.68 -73.90 40.885 $RAW/nyc-landuse.parquet id,geometry,bbox,subtype,class
python3 grab.py base water    -74.03 40.68 -73.90 40.885 $RAW/nyc-water.parquet id,geometry,bbox,subtype,class
python3 grab.py transportation segment -74.03 40.69 -73.90 40.885 $RAW/nyc-segments.parquet id,geometry,bbox,subtype,class,names,road_flags
# Natural Earth countries, via npm world-atlas
npm i world-atlas@2 topojson-client@3
node -e "const t=require('topojson-client'),w=require('world-atlas/countries-50m.json'),fs=require('fs');fs.writeFileSync('$RAW/countries50.geojson',JSON.stringify(t.feature(w,w.objects.countries)));fs.writeFileSync('$RAW/borders50.geojson',JSON.stringify(t.mesh(w,w.objects.countries,(a,b)=>a!==b)))"
python3 build_map.py $RAW ../data
```

The other cities use the same Overture files (building, building_part, places, land_use, segments, and a wider land and water box for the coastline) saved in `$RAW/cities/<city>/` as `building.parquet`, `building_part.parquet`, `places.parquet`, `landuse.parquet`, `segments.parquet`, `region-land.parquet` and `region-water.parquet`. Each city's look (materials per building type, roof colours, how often attics, chimneys, solar panels, domes and water towers appear) is in `STYLE` in `build_map.py`. Their boxes are in `CITIES` at the top of `build_map.py`. Bake one city with `python3 build_map.py $RAW ../data london`, or the world map with `... world`.

Map data © OpenStreetMap contributors and Overture Maps Foundation (ODbL / CDLA-Permissive-2.0). Country shapes: Natural Earth (public domain). three.js: MIT licence (`lib/three-LICENSE.txt`). Fonts: Inter and Archivo Black, SIL Open Font License.
