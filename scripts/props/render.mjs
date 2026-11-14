// Seabed props: render CC0 glTF models (Poly Haven) to transparent WebP sprites in
// headless Chrome on the GPU, with the game's underwater light and sea growth on
// upward faces (render.html).
//
//   python -I scripts/props/fetch.py _ref/models dutch_ship_medium rock_moss_set_01 ...
//   node scripts/props/render.mjs            -> public/img/props/<name>.webp
//
// Views per sprite are in jobs.json: { name, model, yaw, pitch, roll, elev, size,
// growth, tint, pick (one part of a set), hide (parts to leave out, e.g. sails) }.
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = normalize(join(dirname(fileURLToPath(import.meta.url)), '../..'));
const MODELS = '_ref/models', OUT = join(ROOT, 'public/img/props'), TMP = join(ROOT, '_ref/props-png');
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(TMP, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.gltf': 'model/gltf+json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((q, r) => {
    const p = normalize(join(ROOT, decodeURIComponent(q.url.split('?')[0])));
    if (!p.startsWith(ROOT) || !existsSync(p)) { r.writeHead(404); return r.end(); }
    r.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
    r.end(readFileSync(p));
}).listen(8093);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage();
page.on('pageerror', e => console.log('pageerror', String(e).slice(0, 200)));
await page.goto('http://localhost:8093/scripts/props/render.html');
await page.waitForFunction(() => window.ready, { timeout: 20000 });
for (const { name, model, ...view } of JSON.parse(readFileSync(join(ROOT, 'scripts/props/jobs.json'), 'utf8'))) {
    const url = `/${MODELS}/${model}/${model}_1k.gltf`;
    const data = await page.evaluate((url, view) => window.renderModel({ url, ...view }), url, view);
    // Cropped to the visible pixels and saved as WebP by the page itself.
    const webp = await page.evaluate(src => new Promise(done => {
        const img = new Image();
        img.onload = () => {
            const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
            const x = c.getContext('2d'); x.drawImage(img, 0, 0);
            const a = x.getImageData(0, 0, c.width, c.height).data;
            let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
            for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) if (a[(y * c.width + i) * 4 + 3] > 8) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
            const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
            o.getContext('2d').drawImage(c, -x0, -y0);
            done(o.toDataURL('image/webp', 0.86));
        };
        img.src = src;
    }), data);
    writeFileSync(join(TMP, `${name}.png`), Buffer.from(data.split(',')[1], 'base64'));
    writeFileSync(join(OUT, `${name}.webp`), Buffer.from(webp.split(',')[1], 'base64'));
    console.log('rendered', name);
}
await browser.close();
server.close();
