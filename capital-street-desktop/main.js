// Capital Street for Windows, Mac and Linux: the game in a desktop window (Electron).
// The game is served from inside the app through its own app:// address rather than plain files, because it loads its
// map data with fetch(), which browsers don't allow for files. Everything else (saves, settings, playing online)
// works exactly as on the website.
'use strict';
const { app, BrowserWindow, protocol, net, shell, Menu } = require('electron');
const path = require('path'), { pathToFileURL } = require('url');

const WWW = path.join(__dirname, 'www');
const SMOKE = process.argv.includes('--smoke'); // the build's check: open hidden, wait for the city to load, report, quit
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

function open() {
  const win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1024, minHeight: 640, title: 'Capital Street', backgroundColor: '#1c2a78', autoHideMenuBar: true, show: !SMOKE,
    webPreferences: { contextIsolation: true, sandbox: true }
  });
  win.loadURL('app://game/index.html');
  const errors = [];
  if (SMOKE) win.webContents.on('console-message', e => { if (e.level === 'error' || e.level === 3) errors.push(String(e.message).slice(0, 160)); });
  if (SMOKE) win.webContents.once('did-finish-load', async () => {
    for (let i = 0; i < 90; i++) {
      const ok = await win.webContents.executeJavaScript("!!(window.CS && document.getElementById('load').hidden && window.Land && Land.plots.size)").catch(() => false);
      if (ok) { console.log('SMOKE OK: the city loaded'); app.exit(0); return; }
      await new Promise(r => setTimeout(r, 1000));
    }
    const load = await win.webContents.executeJavaScript("(document.getElementById('load') || {}).innerText || ''").catch(() => '?');
    // ::error:: lines become annotations on the GitHub run, readable without opening the log
    console.log(`::error::SMOKE FAIL: the city did not load in 90 s. Loading screen: ${load.replace(/\s+/g, ' ').slice(0, 120)}. Errors: ${errors.slice(0, 3).join(' | ') || 'none'}`);
    app.exit(1);
  });
  // the Terms, Wiki and so on open in their own window; links to anywhere else open in the player's browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('app://')) return { action: 'allow', overrideBrowserWindowOptions: { width: 960, height: 800, autoHideMenuBar: true, backgroundColor: '#1c2a78' } };
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('before-input-event', (e, input) => { // F11: full screen
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
}

app.whenReady().then(() => {
  protocol.handle('app', req => {
    let p = decodeURIComponent(new URL(req.url).pathname);
    if (p === '/' || p === '') p = '/index.html';
    const file = path.normalize(path.join(WWW, p));
    if (!file.startsWith(WWW)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
  Menu.setApplicationMenu(null);
  open();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) open(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
