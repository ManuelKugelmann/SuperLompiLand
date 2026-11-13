// Physical secondary motion for characters drawn from one picture.
//
// Two pure pieces (no Phaser, no DOM; tests/soft.test.mjs):
//
// softnessMap()  reads the picture's alpha and finds what is thin — fins,
//   spines, tassels, tentacles, tail — as opposed to the thick body. Thin parts
//   become soft, the body stays rigid, and so do short things on its rim
//   (spikes). No hand-placed bones: it works for any character art.
//
// SoftHalo  a ring of short chains radiating from the body's centre. Each chain
//   is simulated in world space (verlet): its points are pulled toward where
//   the picture wants them, dragged by the water and kept at length. So when
//   the character darts off, turns or sits in a current, the soft parts trail
//   behind, swing through and settle — on top of the procedural swim motion.

const SPIKE = 0.28;   // things shorter than this (in body radii) are part of the rigid body
const REACH = 0.7;    // from this far out a thin part is fully soft

const smooth = (a, b, v) => { const t = v <= a ? 0 : v >= b ? 1 : (v - a) / (b - a); return t * t * (3 - 2 * t); };

/** Distance of every cell to the nearest transparent one, in cells (two-pass chamfer); the border counts as transparent. */
export function distanceMap(alpha, w, h) {
    const INF = 1e9, d = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) d[i] = alpha[i] > 40 ? INF : 0;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[y * w + x]);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (!d[y * w + x]) continue;
            d[y * w + x] = Math.min(d[y * w + x], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414);
        }
    }
    for (let y = h - 1; y >= 0; y--) {
        for (let x = w - 1; x >= 0; x--) {
            if (!d[y * w + x]) continue;
            d[y * w + x] = Math.min(d[y * w + x], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414);
        }
    }
    return d;
}

/**
 * @param alpha  opacity per cell, 0..255, row by row
 * @returns { soft: Float32Array (0 = rigid body, 1 = fully soft), cx, cy (body centre, 0..1) }
 */
export function softnessMap(alpha, w, h) {
    const INF = 1e9, d = distanceMap(alpha, w, h);
    // Local thickness: the biggest disc inside the shape that covers this cell.
    // (The rim of a fat body is thick; a thin fin is thin all over.)
    const thick = new Float32Array(w * h);
    let most = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const r = d[y * w + x];
            if (r <= 0) continue;
            if (r > most) most = r;
            const R = Math.ceil(r);
            for (let yy = Math.max(0, y - R); yy <= Math.min(h - 1, y + R); yy++) {
                for (let xx = Math.max(0, x - R); xx <= Math.min(w - 1, x + R); xx++) {
                    if ((xx - x) * (xx - x) + (yy - y) * (yy - y) <= r * r && thick[yy * w + xx] < r) thick[yy * w + xx] = r;
                }
            }
        }
    }
    // Distance from the thick body. Only what reaches well away from it is soft:
    // short things on the rim — spikes, bumps, teeth — stay rigid with the body,
    // and a fin is rigid at its root and loosens toward its tip.
    const away = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) away[i] = thick[i] >= 0.62 * most ? 0 : INF;
    const far = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? INF : away[y * w + x]);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            away[y * w + x] = Math.min(away[y * w + x], far(x - 1, y) + 1, far(x, y - 1) + 1, far(x - 1, y - 1) + 1.414, far(x + 1, y - 1) + 1.414);
        }
    }
    for (let y = h - 1; y >= 0; y--) {
        for (let x = w - 1; x >= 0; x--) {
            away[y * w + x] = Math.min(away[y * w + x], far(x + 1, y) + 1, far(x, y + 1) + 1, far(x + 1, y + 1) + 1.414, far(x - 1, y + 1) + 1.414);
        }
    }
    const soft = new Float32Array(w * h);
    let sx = 0, sy = 0, sw = 0;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const t = thick[y * w + x];
            soft[y * w + x] = most > 0
                ? (1 - smooth(0.3 * most, 0.62 * most, t)) * smooth(SPIKE * most, REACH * most, away[y * w + x])
                : 1;
            const wgt = t * t * t;                 // the centre is where the body is thickest
            sx += (x + 0.5) * wgt; sy += (y + 0.5) * wgt; sw += wgt;
        }
    }
    return { soft, cx: sw ? sx / sw / w : 0.5, cy: sw ? sy / sw / h : 0.5 };
}

export class SoftHalo {
    /** @param chains number of rays  @param points points per ray (the first is pinned to the body) */
    constructor(chains = 16, points = 5) {
        this.chains = chains;
        this.points = points;
        const n = chains * points;
        this.x = new Float32Array(n); this.y = new Float32Array(n);     // simulated positions (world)
        this.px = new Float32Array(n); this.py = new Float32Array(n);   // previous positions
        this.tx = new Float32Array(n); this.ty = new Float32Array(n);   // where the picture wants them (world)
        this.fresh = true;
    }

    /** Forget all motion: everything sits exactly where the picture wants it. */
    snap() {
        this.x.set(this.tx); this.y.set(this.ty);
        this.px.set(this.tx); this.py.set(this.ty);
        this.fresh = false;
    }

    /**
     * Advance one frame. Fill `tx`/`ty` first.
     * @param stiffness  0..1 pull toward the picture's pose per step at the tip (stronger near the body)
     * @param drag       0..1 share of the motion the water takes away per step
     * @param flowX,flowY  water velocity (world px per step): soft parts drift with it
     * @param reach      farther than this from the pose = a jump (respawn, flip): snap instead of whipping
     */
    step({ stiffness, drag, flowX = 0, flowY = 0, reach = Infinity, frames = 1 }) {
        const { chains, points, x, y, px, py, tx, ty } = this;
        if (this.fresh) { this.snap(); return; }
        const keep = Math.pow(1 - drag, frames), pull = 1 - Math.pow(1 - stiffness, frames);
        for (let c = 0; c < chains; c++) {
            const o = c * points;
            x[o] = px[o] = tx[o]; y[o] = py[o] = ty[o];
            for (let i = 1; i < points; i++) {
                const k = o + i, f = i / (points - 1);
                if (Math.abs(x[k] - tx[k]) > reach || Math.abs(y[k] - ty[k]) > reach) { this.snap(); return; }
                // Verlet, with the velocity measured against the water.
                const vx = (x[k] - px[k] - flowX * frames) * keep + flowX * frames;
                const vy = (y[k] - py[k] - flowY * frames) * keep + flowY * frames;
                px[k] = x[k]; py[k] = y[k];
                const s = pull * (1.6 - f);                       // the base follows the body closely, the tip is free
                x[k] += vx + (tx[k] - x[k]) * Math.min(1, s);
                y[k] += vy + (ty[k] - y[k]) * Math.min(1, s);
            }
            // Keep every link at the length the picture gives it (no stretching).
            for (let i = 1; i < points; i++) {
                const k = o + i, j = k - 1;
                const rest = Math.hypot(tx[k] - tx[j], ty[k] - ty[j]);
                const dx = x[k] - x[j], dy = y[k] - y[j], len = Math.hypot(dx, dy) || 1e-6;
                x[k] = x[j] + dx / len * rest; y[k] = y[j] + dy / len * rest;
            }
        }
    }
}
