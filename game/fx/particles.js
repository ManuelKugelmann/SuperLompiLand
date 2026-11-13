// One shared particle simulation (pure, no Phaser; spec gamedesign §6.1b).
// Silt, bubbles, oil, smoker plumes, steam, lava embers, ash and smoke are presets
// of the same physics: buoyancy that fades as hot particles cool, drag toward the
// local water flow, a water surface they stop at or pop on, and rock that ends
// them. Struct-of-arrays in typed arrays: no allocation per particle or per frame.

export const PARTICLES = {
    capacity: 900,     // simulated particles at most (one budget constant, spec 14)
    maxDt: 0.05        // larger frame gaps are split so nothing tunnels through rock
};

/**
 * Presets. Units: px and seconds; y grows downward, so positive `rise` floats up.
 * life/size are [min, max]; grow = size factor at the end of life; drag = how fast
 * a particle takes on the water's velocity (1/s); cool = how fast heat fades (1/s,
 * hot particles rise with `rise`, cold ones with `rise * coldRise`); surface: what
 * happens at the waterline ('pop' ends it, 'slick' spreads it along the surface,
 * 'pass' ignores it); blend: 'normal' or 'add'.
 */
export const PRESETS = {
    silt:   { life: [0.9, 1.7], size: [10, 22], grow: 1.8, drag: 3.0, rise: -10, coldRise: 1, cool: 0, alpha: 0.42, color: 0xd8c49c, colorEnd: 0xd8c49c, surface: 'pop', blend: 'normal' },
    bubble: { life: [1.0, 1.8], size: [5, 13], grow: 1.35, drag: 1.6, rise: 150, coldRise: 1, cool: 0, alpha: 0.55, color: 0xffffff, colorEnd: 0xdff6ff, surface: 'pop', blend: 'add' },
    oil:    { life: [6, 9], size: [12, 26], grow: 2.2, drag: 0.9, rise: 55, coldRise: 0.6, cool: 0.12, alpha: 0.78, color: 0x2b2118, colorEnd: 0x3a3026, surface: 'slick', blend: 'normal' },
    smoker: { life: [3, 5], size: [16, 34], grow: 3.0, drag: 1.1, rise: 120, coldRise: 0.15, cool: 0.45, alpha: 0.6, color: 0x2e2c30, colorEnd: 0x55575c, surface: 'pop', blend: 'normal' },
    steam:  { life: [0.8, 1.4], size: [6, 14], grow: 0.6, drag: 1.4, rise: 240, coldRise: 1, cool: 0, alpha: 0.6, color: 0xffffff, colorEnd: 0xcfe9f2, surface: 'pop', blend: 'add' },
    lava:   { life: [1.2, 2.2], size: [4, 10], grow: 0.7, drag: 0.6, rise: -180, coldRise: 1.4, cool: 0.9, alpha: 1, color: 0xffb347, colorEnd: 0x3a1a10, surface: 'pass', blend: 'add' },
    ash:    { life: [6, 10], size: [8, 18], grow: 1.6, drag: 1.8, rise: -12, coldRise: 1, cool: 0, alpha: 0.35, color: 0x8a8c90, colorEnd: 0x6a6c70, surface: 'pass', blend: 'normal' },
    smoke:  { life: [4, 7], size: [20, 40], grow: 3.2, drag: 0.7, rise: 60, coldRise: 0.7, cool: 0.2, alpha: 0.4, color: 0x9a9ea4, colorEnd: 0xd5d8dc, surface: 'pass', blend: 'normal' }
};
export const PRESET_IDS = Object.keys(PRESETS);

const lerp = (a, b, t) => a + (b - a) * t;
export function mixColor(c0, c1, t) {
    const r = lerp((c0 >> 16) & 255, (c1 >> 16) & 255, t), g = lerp((c0 >> 8) & 255, (c1 >> 8) & 255, t), b = lerp(c0 & 255, c1 & 255, t);
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

/**
 * The simulation. `env` (all optional) connects it to the world:
 *   flowAt(x, y, out)  water velocity in px/s written to out.x/out.y (swappable for the flow field)
 *   isSolid(x, y)      true inside rock
 *   surfaceY(x)        water surface height (smaller y = higher)
 */
export function createParticles({ capacity = PARTICLES.capacity, random = Math.random } = {}) {
    const x = new Float32Array(capacity), y = new Float32Array(capacity);
    const vx = new Float32Array(capacity), vy = new Float32Array(capacity);
    const age = new Float32Array(capacity), life = new Float32Array(capacity);
    const size0 = new Float32Array(capacity), heat = new Float32Array(capacity);
    const kind = new Uint8Array(capacity), alive = new Uint8Array(capacity);
    const presets = PRESET_IDS.map(id => PRESETS[id]);
    const flow = { x: 0, y: 0 };
    let next = 0, count = 0;

    function free() {
        // Ring search from the last spawn: cheap and fair; when full, the oldest slot is reused.
        for (let k = 0; k < capacity; k++) {
            const i = (next + k) % capacity;
            if (!alive[i]) { next = (i + 1) % capacity; return i; }
        }
        const i = next;
        next = (next + 1) % capacity;
        count--;
        return i;
    }

    const api = {
        capacity,
        get count() { return count; },

        /** Spawn `n` particles of a preset around (px, py) with base velocity and spread (px/s). */
        spawn(id, px, py, n = 1, { vx: bvx = 0, vy: bvy = 0, spread = 30, radius = 0, heat: h = 1 } = {}) {
            const k = PRESET_IDS.indexOf(id);
            if (k < 0) return 0;
            const p = presets[k];
            for (let j = 0; j < n; j++) {
                const i = free();
                const a = random() * Math.PI * 2, r = radius * Math.sqrt(random());
                x[i] = px + Math.cos(a) * r;
                y[i] = py + Math.sin(a) * r;
                vx[i] = bvx + (random() * 2 - 1) * spread;
                vy[i] = bvy + (random() * 2 - 1) * spread;
                age[i] = 0;
                life[i] = lerp(p.life[0], p.life[1], random());
                size0[i] = lerp(p.size[0], p.size[1], random());
                heat[i] = h;
                kind[i] = k;
                alive[i] = 1;
                count++;
            }
            return n;
        },

        /** Advance by dt seconds. */
        step(dt, env = {}) {
            const { flowAt, isSolid, surfaceY } = env;
            let left = Math.max(0, dt);
            while (left > 1e-6) {
                const h = Math.min(left, PARTICLES.maxDt);
                left -= h;
                for (let i = 0; i < capacity; i++) {
                    if (!alive[i]) continue;
                    const p = presets[kind[i]];
                    age[i] += h;
                    if (age[i] >= life[i]) { alive[i] = 0; count--; continue; }
                    if (p.cool > 0) heat[i] *= Math.exp(-p.cool * h);
                    const rise = p.rise * lerp(p.coldRise, 1, heat[i]);
                    flow.x = 0; flow.y = 0;
                    if (flowAt) flowAt(x[i], y[i], flow);
                    const d = Math.min(1, p.drag * h);
                    vx[i] += (flow.x - vx[i]) * d;
                    vy[i] += (flow.y - rise - vy[i]) * d;
                    const nx = x[i] + vx[i] * h, ny = y[i] + vy[i] * h;
                    if (isSolid && isSolid(nx, ny)) {
                        if (p.surface === 'slick' || p.rise < 0) { vx[i] *= -0.2; vy[i] *= -0.2; continue; }   // rests against rock
                        alive[i] = 0; count--; continue;
                    }
                    x[i] = nx; y[i] = ny;
                    if (surfaceY && p.surface !== 'pass') {
                        const sy = surfaceY(x[i]);
                        if (y[i] <= sy) {
                            if (p.surface === 'pop') { alive[i] = 0; count--; continue; }
                            y[i] = sy;                       // slick: spread along the surface
                            vy[i] = 0;
                            vx[i] *= 1 - Math.min(1, 0.6 * h);
                        }
                    }
                }
            }
        },

        /**
         * Visit every live particle with what a renderer needs:
         * fn(x, y, size, alpha, color, blend, index).
         */
        forEach(fn) {
            for (let i = 0; i < capacity; i++) {
                if (!alive[i]) continue;
                const p = presets[kind[i]];
                const t = age[i] / life[i];
                const fade = Math.min(1, t / 0.12, (1 - t) / 0.3);
                fn(x[i], y[i], size0[i] * lerp(1, p.grow, t), p.alpha * Math.max(0, fade),
                    p.color === p.colorEnd ? p.color : mixColor(p.color, p.colorEnd, p.cool > 0 ? 1 - heat[i] : t), p.blend, i);
            }
        },

        /** Sum of particle "amount" of a preset within radius r of (px, py): exposure for hazards (spec 7.1). */
        densityAt(id, px, py, r) {
            const k = PRESET_IDS.indexOf(id);
            let n = 0;
            for (let i = 0; i < capacity; i++) {
                if (alive[i] && kind[i] === k && (x[i] - px) ** 2 + (y[i] - py) ** 2 < r * r) n++;
            }
            return n;
        },

        clear() { alive.fill(0); count = 0; }
    };
    return api;
}
