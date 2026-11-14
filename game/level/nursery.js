// The root nursery (pure, no Phaser; spec 5.0n): among the mangrove's prop roots a cloud of fry
// hides. It parts round the fish and closes behind it, and two small lemon shark pups patrol the
// roots slowly (mangroves are real shark nurseries). When Sharky is played, the pups swim along
// with their big cousin for a few seconds. Nothing here can hurt.

import { BIOMES } from './biomes.js';

export const NURSERY = {
    biome: 'mangrove',
    at: 0.73,            // how far into the biome it lies (about 8.8 minutes into the journey)
    above: 60,           // px over the calm route the cloud's middle lies (the fish swims right through)
    fry: 56,             // fry in the cloud
    cloud: [520, 190],   // px half width and half height of the cloud
    wander: 24,          // px each fry drifts round its place
    part: 200,           // px round the fish the cloud leaves open ...
    partS: 0.15,         // ... s it takes a fry to get out of the way ...
    closeS: 1.4,         // ... and to come back once the fish has passed
    pups: 2,
    pupLength: 190,      // px a pup is long (Sharky is 250)
    roam: [640, 110],    // px half width and half height of the pups' round ...
    below: 190,          // ... its middle this far under the cloud's
    lap: 18,             // s for one round (slow)
    follow: { near: 300, s: 6, behind: 170, side: 70, catchS: 0.8 },   // Sharky within `near`: they swim along for `s` seconds, this far behind and to the sides
    seen: 650            // px from the cloud's middle at which it goes into the reef book
};

const hash = (i, k) => { const v = Math.sin(i * 73.1 + k * 197.3) * 43758.5453; return v - Math.floor(v); };

/** Where the nursery is: { x, x0, x1 }. */
export function nurserySpot(cfg = NURSERY) {
    const b = BIOMES.find(bi => bi.id === cfg.biome), x = b.from + b.width * cfg.at, half = Math.max(cfg.cloud[0], cfg.roam[0]) + 200;
    return { x, x0: x - half, x1: x + half };
}

/** Fry `i`'s own place in the cloud, as an offset from its middle: evenly filled, denser nowhere. */
export function fryHome(i, cfg = NURSERY) {
    const a = hash(i, 1) * Math.PI * 2, r = Math.sqrt(hash(i, 2));
    return { x: Math.cos(a) * r * cfg.cloud[0], y: Math.sin(a) * r * cfg.cloud[1] };
}

/** How fry `i` drifts: its own pace and phase sideways and up and down (worked out once per fry). */
export function fryPace(i) {
    return { sx: 0.6 + hash(i, 3) * 0.7, px: hash(i, 4) * 6.283, sy: 0.5 + hash(i, 5) * 0.6, py: hash(i, 6) * 6.283 };
}

/** Where fry `i` drifts round its place at time `t` (s): offset into `out`. `pace` = fryPace(i), when the caller keeps it. */
export function fryDrift(i, t, out = {}, cfg = NURSERY, pace = fryPace(i)) {
    out.x = Math.sin(t * pace.sx + pace.px) * cfg.wander;
    out.y = Math.cos(t * pace.sy + pace.py) * cfg.wander * 0.6;
    return out;
}

/**
 * How far a fry whose place is (x, y) gets out of the way of the fish at (fx, fy): straight away
 * from it, just far enough to leave `part` px open. Into `out` ({ x, y }, zero when the fish is not near).
 */
export function fryPart(x, y, fx, fy, out = {}, cfg = NURSERY) {
    const dx = x - fx, dy = y - fy, d = Math.hypot(dx, dy);
    if (d >= cfg.part) { out.x = 0; out.y = 0; return out; }
    const k = (cfg.part - d) / (d || 1);
    out.x = (d ? dx : 1) * k; out.y = dy * k;      // a fry exactly under the fish goes east
    return out;
}

/** Pup `k` on its slow round at time `t` (s), round (cx, cy): { x, y, vx, vy } (px, px/s) into `out`. */
export function pupAt(k, t, cx, cy, out = {}, cfg = NURSERY) {
    const w = Math.PI * 2 / cfg.lap, a = t * w + k * Math.PI * 2 / cfg.pups;
    out.x = cx + Math.cos(a) * cfg.roam[0]; out.y = cy + Math.sin(a * 2 + k * 1.3) * cfg.roam[1];      // a flat figure of eight between the roots, each pup on its own (they never cross at one spot)
    out.vx = -Math.sin(a) * cfg.roam[0] * w; out.vy = Math.cos(a * 2 + k * 1.3) * cfg.roam[1] * 2 * w;
    return out;
}

/** Where pup `k` swims while it follows Sharky at (fx, fy) facing `dir` (+1 east): behind him, one to each side. */
export function pupBeside(k, fx, fy, dir, out = {}, cfg = NURSERY) {
    out.x = fx - dir * cfg.follow.behind * (1 + 0.35 * k);
    out.y = fy + (k % 2 ? 1 : -1) * cfg.follow.side;
    return out;
}
