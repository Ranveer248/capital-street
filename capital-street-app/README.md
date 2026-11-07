# Capital Street: the app

The game (this repo's root, one folder up) wrapped with [Capacitor](https://capacitorjs.com) for Android and iPhone. The app carries every file inside it (the game, three.js, fonts and map data, about 19 MB), so it works offline. It opens Capital Island (`island/sample/`, through a start line `copy-web.js` adds to its copy of `index.html`); the older New York game is still inside at `index.html?newyork`.

- **App name:** Capital Street
- **App ID:** `com.ranveer248.capitalstreet`. Change it in `capacitor.config.json`, `android/app/build.gradle` and the Xcode project **before** the first store upload; after that it can never change.
- **Portrait only.** Status bar hidden. Android's back button closes the open panel.

## Getting a build

GitHub builds the app for you on every push that changes the game or the app (workflow: `.github/workflows/capital-street-app.yml`).

1. On GitHub, open the repo → **Actions** → **Capital Street app** → the latest run.
2. Under **Artifacts**, download **capital-street-android-apk**. Unzip it and open `app-debug.apk` on an Android phone to install it (allow "install unknown apps" when asked).
3. The **ios** job builds the iPhone app for the simulator. That proves the Xcode project compiles. Putting it on a real iPhone needs an Apple developer account (below).

On your own computer:

```sh
cd capital-street-app
npm ci
npm run android   # copies the game in, syncs, opens Android Studio (press Run)
npm run ios       # Mac only: opens Xcode (pick your team under Signing, press Run)
npm run assets    # after changing assets/*.png: regenerates every icon and splash size
```

`www/` is a copy made by `npm run copy`. Edit the game in the repo root (`..`), never in `www/`.

## Google Play

1. Make a Google Play developer account ($25 once) at https://play.google.com/console.
2. Make an upload key, once, and keep it safe (if you lose it, Google can reset it, but it takes days):
   ```sh
   keytool -genkey -v -keystore upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   base64 -w0 upload.jks   # on a Mac: base64 -i upload.jks
   ```
3. On GitHub, open the repo → Settings → Secrets and variables → Actions, and add:
   `ANDROID_KEYSTORE_BASE64` (the base64 text), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`upload`), `ANDROID_KEY_PASSWORD`.
4. Re-run the workflow. A new artifact, **capital-street-play-bundle**, holds `app-release.aab`.
5. In the Play Console, create the app, fill in the store listing (text below), the privacy policy link, the content rating questionnaire and the data safety form. Online play keeps an account ID, the player name, game progress and (only if the player adds one) an email, all for the game to work, never shared or sold; playing offline collects nothing. `privacy.html` lists it all. Then upload the `.aab` to **Internal testing** first, then Production.

## Apple App Store

1. Join the Apple Developer Program ($99 a year) at https://developer.apple.com/programs/.
2. In App Store Connect, create the app with bundle ID `com.ranveer248.capitalstreet`.
3. App Store Connect → Users and Access → Integrations → **App Store Connect API** → make a key with the **App Manager** role. Download the `.p8` file (you can only download it once).
4. Add these GitHub secrets: `APPLE_TEAM_ID` (Membership page), `APPSTORE_KEY_ID`, `APPSTORE_ISSUER_ID`, and `APPSTORE_KEY_P8` (the whole text of the `.p8` file).
5. Re-run the workflow. The **ios** job archives, signs and uploads the build to App Store Connect. It shows up in **TestFlight** after Apple processes it (10 to 30 minutes), so you can install it on your iPhone with the TestFlight app.
6. Fill in the listing and screenshots, then submit for review.

The signed Android bundle and the App Store upload are wired up but have not run yet: they start once the secrets exist. If one fails, the log in the Actions run says why.

## Store listing

- **Name:** Capital Street
- **Subtitle (Apple, 30 characters max):** Build your island empire
- **Short description (Google Play, 80 max):** Farm, build and trade your way to the top of a tropical island.
- **Category:** Games → Simulation
- **Description:**

  > Start with one field and one truck on Capital Island, a sunny island country with a busy capital, seaside towns, farms, beaches, a harbour, an airport and a mountain.
  >
  > Grow crops, deliver them to the co-op and the island's hotels, and level up. Then buy plots of land and build on them: houses, shops, offices, farms, mines and skyscrapers. Mine stone, coal and oil, make goods, and trade your way to the top of the island.
  >
  > • Buy, build, upgrade, rent out or knock down your own plots
  > • Look inside your shops and offices
  > • Sell on the market, deal with the island traders, and bid in the auction house
  > • A living island: traffic lights, roundabouts, delivery trucks, sunshine, rain, thunderstorms and the odd tornado out at sea
  > • Play online on one shared island with other players, or offline on your own
  >
  > No real money and no ads. Every business and price in the game is made up.

- **Keywords (Apple, 100 characters max):** tycoon,island,business,farm,build,trade,city,simulator,empire,money,auction,tropical,builder
- **Privacy policy URL:** `https://ranveer248.github.io/capital-street/privacy.html` (the game's `privacy.html`, live on GitHub Pages).
- **Content rating notes:** a business and building game with no real money and no gambling. The auction house uses in-game money only. Online players choose a name that others can see. The older New York game inside the app has a random market event where a plane crashes into a tower (shown as smoke and a news headline); reviewers may ask about it.
- **Screenshots:** phones need 6.7" iPhone (1290 × 2796) and Android phone shots. Take them from the game in a browser's phone view, or from the simulator.
