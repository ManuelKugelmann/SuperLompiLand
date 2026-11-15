// Several terrain workers side by side (pure: the workers are made by the caller). Shading a chunk's
// pictures is the slow part of the world's generation (about 80 ms on a desktop, several times that on
// a phone); one worker could not keep up with a fast swimmer on a phone, and phones have cores to spare.
// The pool looks like one worker to its user: postMessage, onmessage, terminate. The world's chunks and
// the rock layers behind it share one pool (review: two pools took six workers on an eight-core phone,
// each with its own copy of the world's field): `route(prefix, fn)` hands the answers whose key starts
// with `prefix` to `fn` instead of onmessage.
//
// Requests wait in the pool, not in the workers: a worker holds at most `depth` of them, so a request
// that is no longer wanted can still be taken back (`cancel`) and the play plane's chunks go first
// (a routed prefix with `later` waits behind them; a test at a 4x slower CPU had 18 requests queued
// in the workers, the back rock's behind the world's, and showed back rock late).

export const WORKER_POOL = {
    max: 3,       // workers at most; a device keeps one core for the game itself
    depth: 2      // requests a worker holds at once (one shading, the next ready: no idle gap between them)
};

/** How many workers for a device with `cores` logical cores (navigator.hardwareConcurrency, may be missing). */
export function poolSize(cores, cfg = WORKER_POOL) {
    return Math.max(1, Math.min(cfg.max, (cores | 0) - 1));
}

/**
 * `make()` -> a Worker. A request (a message with a `key`) queues and goes to the least busy worker
 * with room; each keyed answer closes one of that worker's (a key asked for twice counts twice).
 * Messages without a key: `materials` go to every worker, anything else (buffers given back) at once
 * to the least busy one.
 */
export function createPool(make, size, cfg = WORKER_POOL) {
    const workers = [], open = [], routes = [], queue = [];
    const routeOf = key => typeof key === 'string' ? routes.find(r => key.startsWith(r.prefix)) : undefined;
    const least = () => { let best = 0; for (let i = 1; i < workers.length; i++) if (open[i] < open[best]) best = i; return best; };
    const pump = () => {
        while (queue.length) {
            const i = least();
            if (open[i] >= cfg.depth) return;
            let at = queue.findIndex(q => !q.later);
            if (at < 0) at = 0;
            const [q] = queue.splice(at, 1);
            open[i]++;
            workers[i].postMessage(q.msg, q.transfer);
        }
    };
    const pool = {
        onmessage: null,
        onerror: null,
        size,
        postMessage(msg, transfer) {
            if (msg && msg.materials) { for (const w of workers) w.postMessage(msg); return; }
            if (!msg || msg.key === undefined) { workers[least()].postMessage(msg, transfer); return; }
            queue.push({ msg, transfer, later: !!routeOf(msg.key)?.later });
            pump();
        },
        /** Answers whose key starts with `prefix` go to `fn`; `later`: its requests wait behind the others. */
        route(prefix, fn, { later = false } = {}) {
            const r = routeOf(prefix);
            if (r && r.prefix === prefix) Object.assign(r, { fn, later }); else routes.push({ prefix, fn, later });
        },
        /** Take back a request that has not reached a worker yet (true), else it will be answered (false). */
        cancel(key) {
            const at = queue.findIndex(q => q.msg.key === key);
            if (at < 0) return false;
            queue.splice(at, 1);
            return true;
        },
        /** Open requests per worker and the waiting ones (for tests and the perf readout). */
        load() { return open.slice(); },
        waiting() { return queue.length; },
        terminate() { queue.length = 0; for (const w of workers) w.terminate(); }
    };
    for (let i = 0; i < size; i++) {
        const w = make();
        open.push(0);
        w.onmessage = e => {
            const key = e.data && e.data.key;
            if (key !== undefined && open[i] > 0) open[i]--;
            (routeOf(key)?.fn ?? pool.onmessage)?.(e);
            pump();
        };
        w.onerror = err => pool.onerror?.(err);
        workers.push(w);
    }
    return pool;
}
