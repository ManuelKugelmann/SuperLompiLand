// Several terrain workers side by side (pure: the workers are made by the caller). Shading a chunk's
// pictures is the slow part of the world's generation (about 80 ms on a desktop, several times that on
// a phone); one worker could not keep up with a fast swimmer on a phone, and phones have cores to spare.
// The pool looks like one worker to its user: postMessage, onmessage, terminate.

export const WORKER_POOL = { max: 3 };      // workers at most; a device keeps one core for the game itself

/** How many workers for a device with `cores` logical cores (navigator.hardwareConcurrency, may be missing). */
export function poolSize(cores, cfg = WORKER_POOL) {
    return Math.max(1, Math.min(cfg.max, (cores | 0) - 1));
}

/**
 * `make()` -> a Worker. A request (a message with a `key`) goes to the worker with the fewest open
 * requests; its answer (a message with the same `key`) closes it. Messages without a key: `materials`
 * go to every worker, anything else (buffers given back) to the least busy one.
 */
export function createPool(make, size) {
    const workers = [], open = [], owner = new Map();
    const pool = {
        onmessage: null,
        onerror: null,
        size,
        postMessage(msg, transfer) {
            if (msg && msg.materials) { for (const w of workers) w.postMessage(msg); return; }
            let best = 0;
            for (let i = 1; i < workers.length; i++) if (open[i] < open[best]) best = i;
            if (msg && msg.key !== undefined) { open[best]++; owner.set(msg.key, best); }
            workers[best].postMessage(msg, transfer);
        },
        /** Open requests per worker (for tests and the perf readout). */
        load() { return open.slice(); },
        terminate() { for (const w of workers) w.terminate(); }
    };
    for (let i = 0; i < size; i++) {
        const w = make();
        open.push(0);
        w.onmessage = e => {
            const key = e.data && e.data.key, at = owner.get(key);
            if (at !== undefined) { open[at]--; owner.delete(key); }
            pool.onmessage?.(e);
        };
        w.onerror = err => pool.onerror?.(err);
        workers.push(w);
    }
    return pool;
}
