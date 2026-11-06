# Capital Street for PC (Windows, Mac, Linux)

The game (this repo's root, one folder up) in a desktop window, made with [Electron](https://www.electronjs.org). The app carries every file inside it, so it plays offline; signing in to play online works as on the website.

## Getting the builds

GitHub builds the PC versions on every push that changes the game or this folder (workflow: `.github/workflows/capital-street-desktop.yml`).

1. Open the repo on GitHub → **Actions** → **Capital Street desktop** → the latest green run.
2. Under **Artifacts**:
   - **capital-street-windows**: `CapitalStreet-1.0.0-windows.exe` runs without installing; the `.zip` is the same as a folder.
   - **capital-street-mac**: unzip and open Capital Street. Until the app is signed, macOS asks first: right-click it → Open.
   - **capital-street-linux**: the `.AppImage` (make it executable, then run it) or the `.tar.gz`.

## Running it on your own computer

```sh
cd capital-street-desktop
npm install
npm start
```

`www/` is a copy made by `npm run copy`. Edit the game in the repo root (`..`), never in `www/`. `npm run dist` makes the installers in `dist/`.

## itch.io (free, up to 1 GB per file)

1. Create the game page on itch.io (Kind of project: Downloadable).
2. Get an API key: itch.io → Settings → API keys.
3. In this GitHub repo: Settings → Secrets and variables → Actions:
   - secret `BUTLER_API_KEY`: the API key;
   - variable `ITCH_GAME`: `your-itch-name/capital-street`.
4. Re-run the workflow. Every build is then pushed to itch.io as the `windows`, `mac` and `linux` channels.

## Steam ($100 per game, paid back once it earns $1,000)

1. Sign up for Steamworks and pay the app fee; Steam gives you an App ID and depot IDs.
2. Upload the Windows, Mac and Linux builds from the artifacts with the Steamworks SDK (SteamPipe), or add a SteamPipe step to the workflow with a dedicated build account.
3. Before release: a store page, screenshots and a trailer, and a code-signing certificate for Windows and Mac so players don't see warnings.

© 2026 Pocket Rocket Studio
