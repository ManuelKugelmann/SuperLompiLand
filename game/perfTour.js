// A performance tour (pure, no Phaser): `?perftest=1` takes the fish along the whole calm
// route in hops and notes, per biome, the worst frame of game logic, the worst chunk build and
// the most objects and tweens seen. The budgets are the ones in CLAUDE.md (mid-range phone).

export const PERF_TOUR = {
    hop: 2400,        // px between two stops
    stayMs: 1800,     // ms at each stop (chunks load, things settle)
    skipMs: 500,      // ms after a hop that do not count (the jump itself builds many chunks at once)
    budget: { logicMs: 4, chunkMs: 15, objects: 600, tweens: 300 }
};

/**
 * @param from, to   world x of the tour's first and last stop
 * @param biomeAt    x -> biome id
 * Returns { x (current stop), done, step(ms) -> true when it hopped to a new stop,
 *           sample({ logicMs, chunkMs, objects, tweens }), rows() }.
 */
export function createPerfTour(from, to, biomeAt, cfg = PERF_TOUR) {
    const rows = new Map();
    let x = from, at = 0, done = false;
    const row = id => {
        if (!rows.has(id)) rows.set(id, { biome: id, logicMs: 0, chunkMs: 0, objects: 0, tweens: 0, frames: 0 });
        return rows.get(id);
    };
    return {
        get x() { return x; },
        get done() { return done; },
        step(ms) {
            if (done) return false;
            at += ms;
            if (at < cfg.stayMs) return false;
            at = 0;
            if (x >= to) { done = true; return false; }
            x = Math.min(to, x + cfg.hop);
            return true;
        },
        sample(s) {
            if (done || at < cfg.skipMs) return;
            const r = row(biomeAt(x));
            r.logicMs = Math.max(r.logicMs, s.logicMs); r.chunkMs = Math.max(r.chunkMs, s.chunkMs);
            r.objects = Math.max(r.objects, s.objects); r.tweens = Math.max(r.tweens, s.tweens);
            r.frames++;
        },
        /** One row per biome visited, in order, each with `over`: the names of the budgets it broke. */
        rows() {
            return [...rows.values()].map(r => ({ ...r, over: Object.keys(cfg.budget).filter(k => r[k] > cfg.budget[k]) }));
        }
    };
}

/** The result as lines of text (for the screen and the console). */
export function perfReport(rows) {
    const pad = (v, n) => String(v).padStart(n);
    return ['biome       logic ms  chunk ms  objects  tweens',
        ...rows.map(r => `${r.biome.padEnd(10)}${pad(r.logicMs.toFixed(1), 10)}${pad(r.chunkMs.toFixed(1), 10)}${pad(r.objects, 9)}${pad(r.tweens, 8)}${r.over.length ? '   OVER: ' + r.over.join(', ') : ''}`)];
}
