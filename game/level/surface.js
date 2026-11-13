// The water surface. Calm sea level is y = 0.
//
// Two parts add up: a slow rolling swell (a pure function of x and time) and a
// row of spring columns that react to things breaking the surface — a splash
// pushes columns down or up, the disturbance spreads to the neighbours as
// ripples and dies away. Over the shallow beach the swell runs higher (surf).
// Pure logic, no Phaser (tests/surface.test.mjs).
import { surfAt } from './biomes.js';

/** The swell alone: height (world y) at world x and time t (seconds). */
export function waveY(x, t) {
    return (Math.sin(x / 190 + t * 1.5) * 15 + Math.sin(x / 73 - t * 2.2) * 6 + Math.sin(x / 510 + t * 0.6) * 10) * surfAt(x);
}

export const SURFACE = {
    spacing: 32,     // px between spring columns
    columns: 128,    // simulated window (follows the camera)
    tension: 0.028,  // pull back to rest
    damping: 0.035,  // energy lost per step
    spread: 0.22,    // how strongly a column drags its neighbours
    maxOffset: 140
};

export class WaterSurface {
    constructor(cfg = SURFACE) {
        this.cfg = cfg;
        this.h = new Float32Array(cfg.columns);   // offset from the swell (px, + = down)
        this.v = new Float32Array(cfg.columns);
        this.origin = 0;                           // world x of column 0 (multiple of spacing)
    }

    /** Keep the simulated window centred on `centerX`, carrying the ripples along. */
    recenter(centerX) {
        const { spacing, columns } = this.cfg;
        const want = Math.round((centerX - (columns * spacing) / 2) / spacing) * spacing;
        const shift = Math.round((want - this.origin) / spacing);
        if (shift === 0) return;
        const h = new Float32Array(columns), v = new Float32Array(columns);
        for (let i = 0; i < columns; i++) {
            const from = i + shift;
            if (from >= 0 && from < columns) { h[i] = this.h[from]; v[i] = this.v[from]; }
        }
        this.h = h; this.v = v; this.origin = want;
    }

    /** Something hit the surface at x. amount > 0 pushes the water down (entering), < 0 lifts it. */
    splash(x, amount, width = 2) {
        const { spacing, columns, maxOffset } = this.cfg;
        const c = (x - this.origin) / spacing;
        for (let i = Math.max(0, Math.floor(c - width * 3)); i <= Math.min(columns - 1, Math.ceil(c + width * 3)); i++) {
            const d = (i - c) / width;
            this.v[i] = Math.max(-maxOffset, Math.min(maxOffset, this.v[i] + amount * Math.exp(-d * d)));
        }
    }

    /** Advance the springs by one fixed step. */
    step() {
        const { columns, tension, damping, spread, maxOffset } = this.cfg;
        const h = this.h, v = this.v;
        for (let i = 0; i < columns; i++) {
            const left = i > 0 ? h[i - 1] : h[i], right = i < columns - 1 ? h[i + 1] : h[i];
            v[i] += -tension * h[i] + spread * (left + right - 2 * h[i]) * 0.5;
            v[i] *= 1 - damping;
        }
        for (let i = 0; i < columns; i++) h[i] = Math.max(-maxOffset, Math.min(maxOffset, h[i] + v[i]));
    }

    /** Ripple offset at world x (0 outside the simulated window). */
    offsetAt(x) {
        const { spacing, columns } = this.cfg;
        const c = (x - this.origin) / spacing;
        if (c < 0 || c > columns - 1) return 0;
        const i = Math.floor(c), f = c - i;
        return this.h[i] + ((this.h[Math.min(columns - 1, i + 1)] - this.h[i]) * f);
    }

    /** Surface height (world y) at world x and time t. */
    heightAt(x, t) {
        return waveY(x, t) + this.offsetAt(x);
    }
}
