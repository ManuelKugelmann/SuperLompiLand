import { MICRO, MICRO_KINDS, microKey } from './microScatter.js';

// Small ground cover as pictures (fallback art, painted once at start-up): each one is a
// strip of things lying on a ground line, shaded from above so they sit in the painted world.
// Painted files with the same keys (micro_<kind>_<n>) replace them when loaded.

const W = 256, H = 96, GROUND = 82;      // px; everything stands on y = GROUND

function rnd(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const shade = (c, x, y, rx, ry, light, dark) => {
    const g = c.createRadialGradient(x - rx * 0.35, y - ry * 0.45, 1, x, y, Math.max(rx, ry) * 1.1);
    g.addColorStop(0, light); g.addColorStop(1, dark);
    return g;
};

function shadow(c, x, rx) {
    c.fillStyle = 'rgba(10,30,40,0.28)';
    c.beginPath(); c.ellipse(x, GROUND + 3, rx * 1.05, 5, 0, 0, 7); c.fill();
}

function pebble(c, r, x, size, tones) {
    const rx = size, ry = size * (0.55 + r() * 0.25), y = GROUND - ry * 0.75, [light, dark] = tones[Math.floor(r() * tones.length)];
    shadow(c, x, rx);
    c.fillStyle = shade(c, x, y, rx, ry, light, dark);
    c.beginPath(); c.ellipse(x, y, rx, ry, (r() - 0.5) * 0.5, 0, 7); c.fill();
}

const STONE = [['#e9e3d2', '#8f8a7c'], ['#d3cbb8', '#7a7466'], ['#c9d2d0', '#6c7778'], ['#e6d2b4', '#9a7f5e']];
const DARK_STONE = [['#9aa3ad', '#3f4750'], ['#8a8f9c', '#33384a']];

const PAINT = {
    pebbles(c, r) {
        for (let i = 0; i < 9; i++) pebble(c, r, 22 + r() * (W - 44), 7 + r() * 13, STONE);
    },
    rubble(c, r) {
        // Broken coral: pale branching sticks lying about, a few stones between.
        for (let i = 0; i < 4; i++) pebble(c, r, 24 + r() * (W - 48), 6 + r() * 8, STONE);
        c.lineCap = 'round';
        for (let i = 0; i < 9; i++) {
            const x = 20 + r() * (W - 40), len = 16 + r() * 22, a = -0.3 - r() * 2.5, tone = ['#f4ead8', '#f2d9cf', '#e9e0c8'][i % 3];
            c.strokeStyle = 'rgba(10,30,40,0.25)'; c.lineWidth = 7;
            c.beginPath(); c.moveTo(x + 2, GROUND + 1); c.lineTo(x + Math.cos(a) * len + 2, GROUND - 2); c.stroke();
            c.strokeStyle = tone; c.lineWidth = 5;
            const ex = x + Math.cos(a) * len, ey = GROUND - 4 + Math.sin(a) * len * 0.35;
            c.beginPath(); c.moveTo(x, GROUND - 3); c.lineTo(ex, ey); c.stroke();
            c.lineWidth = 3.5;
            c.beginPath(); c.moveTo((x + ex) / 2, (GROUND - 3 + ey) / 2); c.lineTo((x + ex) / 2 + 7, (GROUND - 3 + ey) / 2 - 9); c.stroke();
        }
    },
    shells(c, r) {
        for (let i = 0; i < 3; i++) pebble(c, r, 24 + r() * (W - 48), 5 + r() * 6, STONE);
        for (let i = 0; i < 5; i++) {
            // A scallop: a ribbed fan lying on the sand.
            const x = 28 + r() * (W - 56), size = 11 + r() * 9, tilt = (r() - 0.5) * 0.9;
            const [light, dark] = [['#fff1e0', '#e0a982'], ['#ffe3ea', '#d98aa0'], ['#fff6d8', '#d9b46a']][Math.floor(r() * 3)];
            shadow(c, x, size);
            c.save(); c.translate(x, GROUND - 2); c.rotate(tilt);
            c.fillStyle = shade(c, 0, -size * 0.5, size, size, light, dark);
            c.beginPath(); c.moveTo(0, 0); c.arc(0, -size * 0.25, size, Math.PI * 1.12, Math.PI * 1.88); c.closePath(); c.fill();
            c.strokeStyle = 'rgba(120,70,50,0.35)'; c.lineWidth = 1.2;
            for (let k = -3; k <= 3; k++) { const a = -Math.PI / 2 + k * 0.17; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * size * 0.98, -size * 0.25 + Math.sin(a) * size * 0.98); c.stroke(); }
            c.restore();
        }
    },
    mussels(c, r) {
        // A bed of mussels: dark, glossy, crowded, pointing every way.
        for (let i = 0; i < 16; i++) {
            const x = 26 + r() * (W - 52), len = 11 + r() * 9, a = -Math.PI / 2 + (r() - 0.5) * 1.6, y = GROUND - 3 - r() * 5;
            c.save(); c.translate(x, y); c.rotate(a);
            const g = c.createLinearGradient(0, -len * 0.4, 0, len * 0.4);
            g.addColorStop(0, '#5a6f9a'); g.addColorStop(0.5, '#232a45'); g.addColorStop(1, '#10142a');
            c.fillStyle = g;
            c.beginPath(); c.moveTo(-len * 0.1, 0); c.quadraticCurveTo(len * 0.5, -len * 0.5, len, 0); c.quadraticCurveTo(len * 0.5, len * 0.4, -len * 0.1, 0); c.fill();
            c.strokeStyle = 'rgba(200,220,255,0.5)'; c.lineWidth = 1.3;
            c.beginPath(); c.moveTo(len * 0.15, -len * 0.08); c.quadraticCurveTo(len * 0.5, -len * 0.32, len * 0.85, -len * 0.06); c.stroke();
            c.restore();
        }
        for (let i = 0; i < 3; i++) pebble(c, r, 24 + r() * (W - 48), 5 + r() * 5, DARK_STONE);
    },
    tufts(c, r) {
        // Short algae: bunches of blades, lit at the tips.
        c.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
            const x = 26 + r() * (W - 52), [base, tip] = [['#2f6b3c', '#9bd46a'], ['#3d7a4a', '#c4e07a'], ['#7a3a3a', '#e08a6a']][Math.floor(r() * 3)];
            shadow(c, x, 12);
            for (let k = 0; k < 7; k++) {
                const lean = (r() - 0.5) * 26, tall = 22 + r() * 34;
                const g = c.createLinearGradient(0, GROUND, 0, GROUND - tall);
                g.addColorStop(0, base); g.addColorStop(1, tip);
                c.strokeStyle = g; c.lineWidth = 3 + r() * 2.5;
                c.beginPath(); c.moveTo(x + (r() - 0.5) * 10, GROUND); c.quadraticCurveTo(x + lean * 0.3, GROUND - tall * 0.6, x + lean, GROUND - tall); c.stroke();
            }
        }
    }
};

/** Paint every patch that has no picture yet (call once, at start-up: never inside a chunk build). */
export function makeMicroTextures(scene) {
    for (const kind of MICRO_KINDS) {
        for (let v = 0; v < MICRO.variants; v++) {
            const key = microKey(kind, v);
            if (scene.textures.exists(key)) continue;
            const tex = scene.textures.createCanvas(key, W, H), c = tex.getContext();
            c.filter = 'blur(0.5px)';
            PAINT[kind](c, rnd(MICRO_KINDS.indexOf(kind) * 97 + v * 13 + 5));
            tex.refresh();
        }
    }
}

/** Where a patch's ground line is in its picture (origin y for placing it on the floor). */
export const MICRO_ORIGIN_Y = GROUND / H;
