// A performance tour (pure, no Phaser): `?perftest=1` takes the fish along the whole calm
// route in hops and notes, per biome, the average and the worst frame of game logic, the worst
// chunk build and the most objects and tweens seen. The budgets are the ones in CLAUDE.md (mid-range phone).

export const PERF_TOUR = {
    hop: 12000,       // px between two stops (about 80 stops along the whole journey)
    stayMs: 1800,     // ms at each stop (chunks load, things settle)
    skipMs: 500,      // ms after a hop that never count as steady play ...
    settleMaxMs: 8000, // ... and the stop's time only starts once the chunks in view are complete (at most this long after the hop)
    warmMs: 3000,     // ms after the tour's start that do not count (start-up: first chunks, texture bakes)
    slowStepMs: 8,    // build steps slower than this are named in the report
    budget: { logicMs: 4, chunkMs: 15, objects: 600, tweens: 300 }
};

/**
 * @param from, to   world x of the tour's first and last stop
 * @param biomeAt    x -> biome id
 * Returns { x (current stop), done, step(ms) -> true when it hopped to a new stop,
 *           sample({ logicMs, chunkMs, renderMs, objects, tweens, settling }), rows() }.
 * `renderMs` = what drawing the frame before took (the worst is kept: `renderMs` for steady frames, `hopRenderMs` for a hop's).
 * `settling` = the view is not complete yet after the hop: such frames are the hop's cost (a respawn's, in play),
 * kept apart as `hopMs` (the worst of them, logic and build together), and the stop's time does not run.
 */
export function createPerfTour(from, to, biomeAt, cfg = PERF_TOUR) {
    const rows = new Map();
    let x = from, at = 0, total = 0, done = false, waited = 0;
    const row = id => {
        if (!rows.has(id)) rows.set(id, { biome: id, logicMs: 0, worstMs: 0, sumMs: 0, chunkMs: 0, hopMs: 0, renderMs: 0, hopRenderMs: 0, renders: [], objects: 0, tweens: 0, frames: 0, all: [] });
        return rows.get(id);
    };
    return {
        get x() { return x; },
        get done() { return done; },
        step(ms, settling = false) {
            if (done) return false;
            total += ms;
            if (settling && waited < cfg.settleMaxMs) { waited += ms; return false; }
            at += ms;
            if (at < cfg.stayMs) return false;
            at = 0; waited = 0;
            if (x >= to) { done = true; return false; }
            x = Math.min(to, x + cfg.hop);
            return true;
        },
        sample(s) {
            if (done || total < cfg.warmMs) return;
            const r = row(biomeAt(x));
            if (s.settling || at < cfg.skipMs) { r.hopMs = Math.max(r.hopMs, s.logicMs + s.chunkMs); r.hopRenderMs = Math.max(r.hopRenderMs, s.renderMs || 0); return; }
            r.renderMs = Math.max(r.renderMs, s.renderMs || 0); r.renders.push(s.renderMs || 0);
            // Logic: the average counts against the budget (one slow frame is a hitch, not the frame cost); the worst is shown too.
            r.all.push(s.logicMs); r.sumMs += s.logicMs; r.worstMs = Math.max(r.worstMs, s.logicMs); r.chunkMs = Math.max(r.chunkMs, s.chunkMs);
            r.objects = Math.max(r.objects, s.objects); r.tweens = Math.max(r.tweens, s.tweens);
            r.frames++;
            r.logicMs = r.sumMs / r.frames;
        },
        /** One row per biome visited, in order, each with `over`: the names of the budgets it broke (logic: by its p95). */
        rows() {
            // p50 and p95 of the logic time: the budget is about the usual frame and the slow ones, not one hitch.
            return [...rows.values()].map(({ all, sumMs, renders, ...r }) => {
                const pick = list => { const sorted = [...list].sort((a, b) => a - b); return q => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0; };
                const at = pick(all), drawn = pick(renders);
                // Drawing: its usual and its slow frames too (renderMs is the single worst: one upload or shader compile shows there).
                const row = { ...r, p50Ms: at(0.5), p95Ms: at(0.95), renderP50: drawn(0.5), renderP95: drawn(0.95) };
                const check = { logicMs: row.p95Ms, chunkMs: row.chunkMs, objects: row.objects, tweens: row.tweens };
                return { ...row, over: Object.keys(cfg.budget).filter(k => check[k] > cfg.budget[k]) };
            });
        }
    };
}

/** The result as lines of text (for the screen and the console). */
export function perfReport(rows) {
    const pad = (v, n) => String(v).padStart(n);
    return ['biome       logic avg       p50       p95     worst  chunk ms  objects  tweens    hop ms render p50/p95/max  hop render',
        ...rows.map(r => `${r.biome.padEnd(10)}${pad(r.logicMs.toFixed(1), 11)}${pad(r.p50Ms.toFixed(1), 10)}${pad(r.p95Ms.toFixed(1), 10)}${pad(r.worstMs.toFixed(1), 10)}${pad(r.chunkMs.toFixed(1), 10)}${pad(r.objects, 9)}${pad(r.tweens, 8)}${pad(r.hopMs.toFixed(0), 10)}${pad(`${r.renderP50.toFixed(1)}/${r.renderP95.toFixed(1)}/${r.renderMs.toFixed(0)}`, 20)}${pad(r.hopRenderMs.toFixed(0), 12)}${r.over.length ? '   OVER: ' + r.over.join(', ') : ''}`)];
}

/** The build steps slower than `slowStepMs`, slowest first, as lines of text. `steps` = Map(name -> { ms, x }), `biomeAt` = x -> biome id. */
export function slowSteps(steps, biomeAt, cfg = PERF_TOUR) {
    return [...steps].filter(([, v]) => v.ms > cfg.slowStepMs).sort((a, b) => b[1].ms - a[1].ms)
        .map(([name, v]) => `slow build step: ${name.padEnd(18)} ${v.ms.toFixed(1).padStart(7)} ms  (${biomeAt(v.x)}, x ${Math.round(v.x)})`);
}

/**
 * Times the `update` and `animate` of every part of `host` (its own properties that have one), and
 * whatever `extra` names ([[label, object, method], ...], e.g. the physics step), for the tour.
 * Returns { frame (Map name -> ms spent in it since the last next()), next() }.
 * Only used with `?perftest=1`: it tells which part a slow frame belongs to.
 */
export function watchParts(host, now = () => performance.now(), extra = []) {
    const frame = new Map();
    const watch = (key, part, fn) => {
        const call = part[fn];
        if (typeof call !== 'function') return;
        part[fn] = function (...args) {
            const t = now(), out = call.apply(this, args);
            frame.set(key, (frame.get(key) || 0) + now() - t);
            return out;
        };
    };
    for (const name of Object.keys(host)) {
        const part = host[name];
        if (part && typeof part === 'object') for (const fn of ['update', 'animate']) watch(`${name}.${fn}`, part, fn);
    }
    for (const [label, part, fn] of extra) if (part) watch(label, part, fn);
    return { frame, next: () => frame.clear() };
}

/**
 * A frame of `total` ms split into its parts, as text: the `count` slowest and what is left over
 * ("rest": the host's own code between its parts): "529 ms = matter.step 400, level.update 20, rest 80".
 */
export function splitFrame(total, frame, count = 4) {
    const parts = [...frame].sort((a, b) => b[1] - a[1]), named = parts.slice(0, count), rest = total - parts.reduce((sum, [, ms]) => sum + ms, 0);
    return `${total.toFixed(0)} ms = ${[...named.map(([k, ms]) => `${k} ${ms.toFixed(0)}`), `rest ${Math.max(0, rest).toFixed(0)}`].join(', ')}`;
}

