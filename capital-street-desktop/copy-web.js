// Copies the game (the repo root, one folder up) into www/, which goes inside the desktop app, and the app icon into
// build/. The phone app, this folder, the map tools, the server rules and the notes stay out.
const fs = require('fs'), path = require('path');
const SRC = path.join(__dirname, '..'), OUT = path.join(__dirname, 'www');
const SKIP = new Set(['capital-street-app', 'capital-street-desktop', 'tools', 'server', 'README.md', 'RESEARCH.md']);
const skip = name => SKIP.has(name) || name.startsWith('.'); // .git, .github, .claude, .gitattributes, .nojekyll
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
for (const e of fs.readdirSync(SRC)) if (!skip(e)) fs.cpSync(path.join(SRC, e), path.join(OUT, e), { recursive: true });
fs.mkdirSync(path.join(__dirname, 'build'), { recursive: true });
fs.copyFileSync(path.join(SRC, 'capital-street-app', 'assets', 'icon-only.png'), path.join(__dirname, 'build', 'icon.png'));
let n = 0, bytes = 0;
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else { n++; bytes += fs.statSync(f).size; } } })(OUT);
console.log(`www: ${n} files, ${(bytes / 1048576).toFixed(1)} MB`);
