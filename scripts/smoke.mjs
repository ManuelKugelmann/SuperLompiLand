// Smoke check of the production build (dist/): the game loads, the title comes up, the game
// itself starts at two places and runs a few seconds, and no page error happens on the way.
// Part of the push gate after `npm run build`: npm run smoke. Skipped (exit 0) where no Chrome
// is found; set CHROME to its path if it is somewhere else.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PLACES = [60000, 560000];      // the lagoon near the start, and the harbour (the most going on)
const RUN_MS = 4000;
const CHROMES = [process.env.CHROME, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };

const chrome = CHROMES.find(p => existsSync(p));
if (!chrome) { console.log('smoke: no Chrome found, skipped'); process.exit(0); }
if (!existsSync(resolve(ROOT, 'index.html'))) { console.error('smoke: no dist/ (run npm run build first)'); process.exit(1); }
const { default: puppeteer } = await import('puppeteer-core');

const server = createServer(async (req, res) => {
    try {
        let path = decodeURIComponent(req.url.split('?')[0]);
        if (path.endsWith('/')) path += 'index.html';
        const file = resolve(ROOT, '.' + path);
        if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
        const body = await readFile(file);
        res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
    } catch { res.writeHead(404).end(); }
}).listen(0);
const port = await new Promise(r => server.on('listening', () => r(server.address().port)));

const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
try {
    for (const x of PLACES) {
        const page = await browser.newPage();
        await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true });
        page.on('pageerror', e => problems.push(`${x}: ${String(e).slice(0, 300)}`));
        await page.goto(`http://localhost:${port}/?smoke&at=${x},700`, { waitUntil: 'load', timeout: 60000 });
        await page.waitForFunction(() => window.__game?.scene.isActive('SuperLompi') || window.__game?.scene.isActive('SuperLompi_Story'), { polling: 300, timeout: 60000 })
            .catch(() => problems.push(`${x}: the title never came up`));
        const state = await page.evaluate(async ms => {
            const g = window.__game;
            if (!g) return { ok: false, why: 'no game' };
            try { localStorage.setItem('sll_story_seen', '1'); } catch { /* private window */ }
            g.scene.getScene('SuperLompi_Main')?.progression?.set?.('style_asked', true);
            for (const s of g.scene.getScenes(true)) if (s.scene.key !== 'SuperLompi_Main') s.scene.stop();
            g.scene.start('SuperLompi_Main');
            await new Promise(r => setTimeout(r, ms));
            const m = g.scene.getScene('SuperLompi_Main'), s = m?.fish?.sprite;
            return { ok: !!(g.scene.isActive('SuperLompi_Main') && s && Number.isFinite(s.x) && Number.isFinite(s.y)), frames: g.loop.frame };
        }, RUN_MS + 5000);
        if (!state.ok) problems.push(`${x}: the game did not run (${state.why || 'Main not active or the fish has no place'})`);
        else console.log(`smoke ${x}: ok, ${state.frames} frames`);
        await page.close();
    }
} finally {
    await browser.close();
    server.close();
}
if (problems.length) { console.error('smoke: FAILED\n' + problems.join('\n')); process.exit(1); }
console.log('smoke: ok');
