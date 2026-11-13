// One screenshot per biome, for the README lineup and art reviews (gamedesign 1.2).
//
//   npm run dev                      (in another terminal; or pass --url)
//   node scripts/capture-biomes.mjs [--url http://localhost:8080/] [--only reef,kelp]
//
// Starts the game at each biome (?at=<id>), hides the HUD, waits for the world to
// settle and saves docs/biomes/<id>.jpg; then rewrites the README section between
// <!-- biomes:start --> and <!-- biomes:end -->.
// Needs a local Chrome or Edge (puppeteer-core drives it; nothing is downloaded).
// Set CHROME_PATH if it is not found.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { BIOMES } from '../game/level/biomes.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'docs/biomes');
const README = resolve(ROOT, 'README.md');
const W = 1600, H = 900;           // capture size (16:9, the game's landscape)
const SETTLE_MS = 6000;            // chunks built, creatures moving, light settled

const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : fallback;
};
const url = arg('url', 'http://localhost:8080/').replace(/\/?$/, '/');
const only = arg('only', '');
const places = [...BIOMES.map(b => ({ id: b.id, name: b.name })), { id: 'abyss', name: { de: 'Abgrund', en: 'The Abyss' } }]
    .filter(p => !only || only.split(',').includes(p.id));

const chrome = process.env.CHROME_PATH || [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
].find(p => existsSync(p));
if (!chrome) { console.error('No Chrome/Edge found — set CHROME_PATH.'); process.exit(1); }

mkdirSync(OUT, { recursive: true });
// A visible window: headless software GL renders the lighting differently.
const browser = await puppeteer.launch({
    executablePath: chrome, headless: false, defaultViewport: null,
    args: [`--window-size=${W},${H + 80}`, '--no-first-run', '--no-default-browser-check']
});
const [page] = await browser.pages();
await page.setViewport({ width: W, height: H });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

for (const p of places) {
    await page.goto(`${url}?at=${p.id}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__game?.scene.isActive('SuperLompi') || window.__game?.scene.isActive('SuperLompi_Story'),
        { polling: 300, timeout: 30000 }).catch(() => {});
    await page.evaluate(() => {
        try { localStorage.setItem('sll_story_seen', '1'); } catch { /* ignore */ }
        const g = window.__game;
        g.registry.set('room', null);
        for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'SuperLompi_Main') s.scene.stop();
        g.scene.start('SuperLompi_Main');
    });
    await new Promise(r => setTimeout(r, SETTLE_MS));
    await page.evaluate(() => { const hud = window.__game.scene.getScene('SuperLompi_Main_Hud'); if (hud) hud.sys.setVisible(false); });
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: resolve(OUT, `${p.id}.jpg`), type: 'jpeg', quality: 78 });
    console.log(`captured ${p.id}`);
}
await browser.close();
if (errors.length) console.warn('page errors:', errors.slice(0, 5));

// README lineup: two shots per row, captioned with the biome name.
const all = [...BIOMES.map(b => ({ id: b.id, name: b.name })), { id: 'abyss', name: { de: 'Abgrund', en: 'The Abyss' } }]
    .filter(p => existsSync(resolve(OUT, `${p.id}.jpg`)));
const cell = p => `<td width="50%"><img src="docs/biomes/${p.id}.jpg" alt="${p.name.en}"><br><b>${p.name.de}</b> · ${p.name.en}</td>`;
let table = '<table>\n';
for (let i = 0; i < all.length; i += 2) table += `<tr>${cell(all[i])}${all[i + 1] ? cell(all[i + 1]) : '<td></td>'}</tr>\n`;
table += '</table>';
const section = `<!-- biomes:start -->\n## Biomes, west to east\n\nOne shot per biome, captured with \`node scripts/capture-biomes.mjs\` (start spots via \`?at=<biome>\`).\n\n${table}\n<!-- biomes:end -->`;
let readme = readFileSync(README, 'utf8');
if (readme.includes('<!-- biomes:start -->')) {
    readme = readme.replace(/<!-- biomes:start -->[\s\S]*?<!-- biomes:end -->/, section);
} else {
    readme = readme.replace('<!-- devlog:end -->', `<!-- devlog:end -->\n\n${section}`);
}
writeFileSync(README, readme);
console.log(`README lineup: ${all.length} biomes`);
