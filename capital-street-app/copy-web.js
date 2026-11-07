// Copies the game (the repo root, one folder up) into www/, which Capacitor packs into the Android and iOS apps.
// The app itself, the map tools, the server rules and the notes stay out of the app.
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..'), OUT = path.join(__dirname, 'www');
const SKIP = new Set(['capital-street-app', 'capital-street-desktop', 'tools', 'server', 'README.md', 'RESEARCH.md']);
const skip = name => SKIP.has(name) || name.startsWith('.'); // .git, .github, .claude, .gitattributes, .nojekyll
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
for (const e of fs.readdirSync(SRC)) if (!skip(e)) fs.cpSync(path.join(SRC, e), path.join(OUT, e), { recursive: true });
// the app opens Capital Island, like the website (New York stays inside at index.html?newyork)
const START = path.join(OUT, 'index.html'), html = fs.readFileSync(START, 'utf8'), AT = '<meta charset="utf-8">';
if (!html.includes(AT)) throw new Error('copy-web: index.html has no <meta charset="utf-8"> to put the island start after');
fs.writeFileSync(START, html.replace(AT, AT + '\n<script>if (!/[?&](newyork|with|city)\\b/.test(location.search)) location.replace(\'island/sample/\' + location.search + location.hash);</script>'));
let n = 0, bytes = 0;
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else { n++; bytes += fs.statSync(f).size; } } })(OUT);
console.log(`www: ${n} files, ${(bytes / 1048576).toFixed(1)} MB`);
