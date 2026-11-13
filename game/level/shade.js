// Per-pixel terrain shading. One chunk becomes two small RGBA pictures:
//   rock  the rock itself: matte albedo running from the rim into the core, lit
//         from the surface (soft key light from above, teal fill from the water,
//         warm bounce from below), fine grain, sand settling on upward faces
//   back  what lies behind: cave back walls and soft occlusion in the water
//         next to rock
// Everything is a smooth function of the density field, so there are no steps,
// facets or chunk seams. Pure maths (no Phaser, no DOM): it runs in the terrain
// worker and, as a fallback, on the main thread. Tested in tests/shade.test.mjs.
import { hash, vnoise } from './terrain.js';
import { biomeBlendAt } from './biomes.js';
import { FIELD } from './density.js';

export const SHADE = {
    rockSize: 640,        // rock picture, px per chunk side
    backSize: 320,        // back picture (soft anyway)
    node: 4,              // rock pixels per density sample
    coreDist: 300,        // world px from the rim to the darkest core colour
    coreShade: 0.86,      // how far into the palette the core goes (1 = the darkest colour)
    bevel: 46,            // world px over which the rock rounds off toward its edge
    relief: 1.7,          // how steep that rounding is (higher = stronger light/shadow)
    bump: 0.36,           // strength of the fine surface grain in the lighting
    grain: 0.26,          // strength of the fine surface grain in the colour
    light: [-0.3, -0.72, 0.62],    // toward the light: up, a little from the left, toward the viewer
    key: [1.0, 0.96, 0.86],        // sunlight through water
    sky: [0.36, 0.5, 0.54],        // fill on faces looking up (teal)
    bounce: [0.26, 0.21, 0.17],    // fill on faces looking down (warm, dim)
    keyStrength: 0.9,
    deepLight: 0.5,       // share of the key light lost at the deepest regular seabed
    deepTint: [0x1a, 0x3a, 0x62],
    deepMix: 0.5,         // how far the albedo moves to deepTint at the deepest regular seabed
    sand: [0xf4, 0xe3, 0xb4],
    sandReach: 60,        // world px into the rock that sand covers on upward faces
    wallMix: [0x0a, 0x2a, 0x44],
    wallAlpha: 0.62,
    occlusion: 0.36,      // darkest shade in the water right at the rock
    occlusionReach: 0.085 // density range in the water over which it fades out
};

const TILE = 256;
const DARK = [0x04, 0x16, 0x2a];   // shade in the water next to rock
let tile = null;

/** Tileable fine grain: height in 0..1 and its slope, shared by all chunks. */
function grainTile() {
    if (tile) return tile;
    const h = new Float32Array(TILE * TILE);
    const octaves = [[4, 0.3], [8, 0.28], [16, 0.22], [32, 0.14], [64, 0.06]];
    for (const [period, weight] of octaves) {
        const cell = TILE / period;
        for (let y = 0; y < TILE; y++) {
            const gy = y / cell, iy = Math.floor(gy), fy = gy - iy, sy = fy * fy * (3 - 2 * fy);
            for (let x = 0; x < TILE; x++) {
                const gx = x / cell, ix = Math.floor(gx), fx = gx - ix, sx = fx * fx * (3 - 2 * fx);
                const x1 = (ix + 1) % period, y1 = (iy + 1) % period;
                const a = hash(ix, iy, period), b = hash(x1, iy, period), c = hash(ix, y1, period), d = hash(x1, y1, period);
                h[y * TILE + x] += weight * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy);
            }
        }
    }
    const dx = new Float32Array(TILE * TILE), dy = new Float32Array(TILE * TILE);
    for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
            const i = y * TILE + x;
            dx[i] = h[y * TILE + ((x + 1) & 255)] - h[y * TILE + ((x + 255) & 255)];
            dy[i] = h[((y + 1) & 255) * TILE + x] - h[((y + 255) & 255) * TILE + x];
        }
    }
    tile = { h, dx, dy };
    return tile;
}

const smooth = (a, b, v) => { const t = v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a); return t * t * (3 - 2 * t); };

/**
 * Shade one chunk.
 * @returns { rock, back }  Uint8ClampedArray RGBA, SHADE.rockSize² and SHADE.backSize²
 */
export function shadeChunk(field, seed, ox, oy, span, cfg = SHADE) {
    const S = cfg.rockSize, node = cfg.node, M = S / node, W = M + 3;   // one extra sample all around
    const ws = span / M;                       // world px per density sample
    const T = FIELD.threshold;

    // Density, its slope and the cave-wall mask on the sample grid.
    const D = new Float32Array(W * W), mask = new Float32Array(W * W);
    for (let j = 0; j < W; j++) {
        const y = oy + (j - 1) * ws;
        for (let i = 0; i < W; i++) {
            const x = ox + (i - 1) * ws;
            D[j * W + i] = field.density(x, y);
            mask[j * W + i] = y > 600 ? smooth(0.53, 0.58, vnoise(x / 1500, y / 1500, seed + 31)) : 0;
        }
    }
    const GX = new Float32Array(W * W), GY = new Float32Array(W * W);
    for (let j = 1; j < W - 1; j++) {
        for (let i = 1; i < W - 1; i++) {
            GX[j * W + i] = (D[j * W + i + 1] - D[j * W + i - 1]) / (2 * ws);
            GY[j * W + i] = (D[(j + 1) * W + i] - D[(j - 1) * W + i]) / (2 * ws);
        }
    }

    // Rock colours per picture column: the biome changes smoothly along x.
    const pal = new Float32Array(S * 15);
    for (let px = 0; px < S; px++) {
        const { a, b, t } = biomeBlendAt(ox + (px + 0.5) * span / S);
        for (let k = 0; k < 5; k++) {
            const ca = a.rock[k], cb = b.rock[k];
            for (let c = 0; c < 3; c++) {
                const sh = 16 - c * 8, va = (ca >> sh) & 255, vb = (cb >> sh) & 255;
                pal[px * 15 + k * 3 + c] = va + (vb - va) * t;
            }
        }
    }

    const g = grainTile(), gh = g.h, gdx = g.dx, gdy = g.dy;
    const tx0 = Math.round(ox / span) * S, ty0 = Math.round(oy / span) * S;   // grain stays put across chunks
    const L = cfg.light, ll = Math.sqrt(L[0] * L[0] + L[1] * L[1] + L[2] * L[2]);
    const lx = L[0] / ll, ly = L[1] / ll, lz = L[2] / ll;
    const pxWorld = span / S, aa = 1 / (pxWorld * 1.4);
    // Plain locals: this loop runs for every pixel of every chunk.
    const bevel = cfg.bevel, relief = cfg.relief, bump = cfg.bump * 9, coreDist = cfg.coreDist, core = cfg.coreShade * 3.9999;
    const sandReach = cfg.sandReach, grainLo = 1 - cfg.grain / 2, grainK = cfg.grain;
    const [sandR, sandG, sandB] = cfg.sand, [deepR, deepG, deepB] = cfg.deepTint;
    const [bncR, bncG, bncB] = cfg.bounce, [keyR, keyG, keyB] = cfg.key;
    const skyR = cfg.sky[0] - bncR, skyG = cfg.sky[1] - bncG, skyB = cfg.sky[2] - bncB;
    const rock = new Uint8ClampedArray(S * S * 4);

    for (let py = 0; py < S; py++) {
        const fy = (py + 0.5) / node + 1, j = Math.floor(fy), v = fy - j;
        const deep = Math.min(1, Math.max(0, (oy + (py + 0.5) * pxWorld) / FIELD.maxDepth));
        const keyK = cfg.keyStrength * (1 - cfg.deepLight * deep), tintK = cfg.deepMix * deep;
        const gyRow = ((ty0 + py) & 255) * TILE;
        for (let px = 0; px < S; px++) {
            const fx = (px + 0.5) / node + 1, i = Math.floor(fx), u = fx - i;
            const i00 = j * W + i, i10 = i00 + 1, i01 = i00 + W, i11 = i01 + 1;
            const w00 = (1 - u) * (1 - v), w10 = u * (1 - v), w01 = (1 - u) * v, w11 = u * v;
            const d = D[i00] * w00 + D[i10] * w10 + D[i01] * w01 + D[i11] * w11;
            if (d < T - 0.02) continue;                      // clearly water
            const gx = GX[i00] * w00 + GX[i10] * w10 + GX[i01] * w01 + GX[i11] * w11;
            const gy = GY[i00] * w00 + GY[i10] * w10 + GY[i01] * w01 + GY[i11] * w11;
            const gl = Math.max(1e-5, Math.sqrt(gx * gx + gy * gy));
            const dist = (d - T) / gl;                       // world px into the rock (negative = water)
            const alpha = dist * aa + 0.5;                   // soft, anti-aliased outline
            if (alpha <= 0) continue;
            const inside = dist > 0 ? dist : 0;

            const gi = gyRow + ((tx0 + px) & 255);
            // Outward direction of the surface (toward the water) and how much the
            // rock still rounds off here.
            const outY = -gy / gl;
            const edge = inside >= bevel ? 0 : 1 - inside / bevel;
            const tilt = edge * Math.sqrt(edge) * relief;
            let nx = -gx / gl * tilt - gdx[gi] * bump, ny = outY * tilt - gdy[gi] * bump;
            const nl = 1 / Math.sqrt(nx * nx + ny * ny + 1);
            nx *= nl; ny *= nl;
            const dot = nx * lx + ny * ly + nl * lz;
            const lambert = dot > 0 ? dot * keyK : 0;
            const up = 0.5 - 0.5 * ny;                        // 1 = faces the surface, 0 = faces the deep

            // Albedo: from the rim colour into the core, with grain; sand lies on upward faces.
            const r = inside >= coreDist ? 1 : inside / coreDist;
            const depthIn = Math.sqrt(r * Math.sqrt(r)) * core;        // r^0.75: quick at the rim, slow in the core
            const k = depthIn | 0, kt = depthIn - k, p = px * 15 + k * 3;
            const sandy = inside >= sandReach || outY > -0.3 ? 0 : smooth(0.3, 0.8, -outY) * (1 - inside / sandReach) * 0.8;
            const tone = grainLo + grainK * gh[gi];
            const o = (py * S + px) * 4;
            let cr = pal[p] + (pal[p + 3] - pal[p]) * kt, cg = pal[p + 1] + (pal[p + 4] - pal[p + 1]) * kt, cb = pal[p + 2] + (pal[p + 5] - pal[p + 2]) * kt;
            cr += (sandR - cr) * sandy; cg += (sandG - cg) * sandy; cb += (sandB - cb) * sandy;
            cr += (deepR - cr) * tintK; cg += (deepG - cg) * tintK; cb += (deepB - cb) * tintK;
            rock[o] = cr * tone * (bncR + skyR * up + keyR * lambert);
            rock[o + 1] = cg * tone * (bncG + skyG * up + keyG * lambert);
            rock[o + 2] = cb * tone * (bncB + skyB * up + keyB * lambert);
            rock[o + 3] = alpha >= 1 ? 255 : alpha * 255;
        }
    }

    // Back picture: cave walls behind the water, and shade that gathers next to rock.
    const B = cfg.backSize, bn = S / B, back = new Uint8ClampedArray(B * B * 4);
    for (let py = 0; py < B; py++) {
        const fy = (py + 0.5) * bn / node + 1, j = Math.floor(fy), v = fy - j;
        const wy = oy + (py + 0.5) * span / B;
        const tintK = cfg.deepMix * Math.min(1, Math.max(0, wy / FIELD.maxDepth));
        for (let px = 0; px < B; px++) {
            const fx = (px + 0.5) * bn / node + 1, i = Math.floor(fx), u = fx - i;
            const i00 = j * W + i, i10 = i00 + 1, i01 = i00 + W, i11 = i01 + 1;
            const w00 = (1 - u) * (1 - v), w10 = u * (1 - v), w01 = (1 - u) * v, w11 = u * v;
            const d = D[i00] * w00 + D[i10] * w10 + D[i01] * w01 + D[i11] * w11;
            const m = mask[i00] * w00 + mask[i10] * w10 + mask[i01] * w01 + mask[i11] * w11;
            const wallA = cfg.wallAlpha * m * smooth(T - 0.17, T - 0.1, d);
            const occ = smooth(T - cfg.occlusionReach, T, d);
            const occA = cfg.occlusion * occ * occ;
            const a = occA + wallA * (1 - occA);
            if (a <= 0.004) continue;
            const grain = g.h[(((ty0 >> 1) + py) & 255) * TILE + (((tx0 >> 1) + px) & 255)];
            const p = Math.min(S - 1, Math.floor((px + 0.5) * bn)) * 15 + 6;       // the middle rock colour
            const o = (py * B + px) * 4;
            for (let c = 0; c < 3; c++) {
                let wall = pal[p + c] + (cfg.wallMix[c] - pal[p + c]) * 0.45;
                wall += (cfg.deepTint[c] - wall) * tintK;
                wall *= 0.8 + 0.4 * grain;
                back[o + c] = (DARK[c] * occA + wall * wallA * (1 - occA)) / a;
            }
            back[o + 3] = a * 255;
        }
    }
    return { rock, back };
}
