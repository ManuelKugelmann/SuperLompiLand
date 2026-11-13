// Zero-dependency PNG generator for PWA icons + the game card preview.
// Draws a simple shaded pufferfish so the project builds with no binary assets
// committed. Replace these with real art (e.g. exported from Rive) later.
import { deflateSync, crc32 } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function chunk(type, data) {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body) >>> 0, 0);
    return Buffer.concat([len, body, crc]);
}

function png(size, pixel) {
    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
    ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
    const raw = Buffer.alloc(size * (size * 4 + 1));
    let p = 0;
    for (let y = 0; y < size; y++) {
        raw[p++] = 0; // no filter
        for (let x = 0; x < size; x++) {
            const c = pixel(x, y);
            raw[p++] = c[0]; raw[p++] = c[1]; raw[p++] = c[2]; raw[p++] = c[3] ?? 255;
        }
    }
    return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function fishPixel(size) {
    const c = size / 2, R = size * 0.33, spikes = 14, sr = R * 1.17;
    return (x, y) => {
        const t = y / size;
        let r = lerp(26, 5, t), g = lerp(163, 59, t), b = lerp(181, 66, t);
        const dx = x - c, dy = y - c, d = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
        if (d > R * 0.98 && d < sr) {
            const seg = ((ang + Math.PI) / (2 * Math.PI)) * spikes;
            const frac = Math.abs(seg - Math.round(seg));
            const edge = (sr - d) / (sr - R * 0.98);
            if (frac < edge * 0.5) { r = 239; g = 138; b = 75; }
        }
        if (d < R) {
            const lx = x - (c - R * 0.3), ly = y - (c - R * 0.33);
            const s = clamp(1 - Math.hypot(lx, ly) / (R * 1.3), 0, 1);
            r = lerp(201, 255, s); g = lerp(102, 210, s); b = lerp(31, 120, s);
            const ex = c + R * 0.42, ey = c - R * 0.22, ed = Math.hypot(x - ex, y - ey);
            if (ed < R * 0.2) { r = g = b = 255; }
            if (ed < R * 0.1) { r = 32; g = 48; b = 64; }
        }
        return [Math.round(r), Math.round(g), Math.round(b), 255];
    };
}

const targets = [
    ['public/pwa-192x192.png', 192],
    ['public/pwa-512x512.png', 512],
    ['assets/card_preview.png', 512]
];
for (const [rel, size] of targets) {
    const out = resolve(ROOT, rel);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, png(size, fishPixel(size)));
    console.log('wrote', rel, `(${size}x${size})`);
}
