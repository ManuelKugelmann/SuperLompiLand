// Checks for everything that arrives from other players (pure, unit-tested).
// Spec: validate every incoming message (size, types, ranges); ignore peers
// that keep sending garbage. Returns a clean copy, or null.

const LIMIT = 1e7;          // world coordinates stay far inside this
const SPEED = 400;          // px per 60 Hz step — far above anything a fish does
const ID_MAX = 64;

const num = (v, lim) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim;
const str = (v, max) => typeof v === 'string' && v.length > 0 && v.length <= max;

/** Fish state snapshot. */
export function cleanState(d) {
    if (!d || typeof d !== 'object') return null;
    if (!num(d.n, 1e12) || !num(d.t, 1e13) || !num(d.x, LIMIT) || !num(d.y, LIMIT)) return null;
    if (!num(d.vx, SPEED) || !num(d.vy, SPEED)) return null;
    if (!str(d.s, 24) || !str(d.c, 24) || (d.f !== 1 && d.f !== -1)) return null;
    return { n: d.n, t: d.t, x: d.x, y: d.y, vx: d.vx, vy: d.vy, s: d.s, f: d.f, c: d.c };
}

/** One-shot events: a friend is down at (x, y) / someone revived player `id`. */
export function cleanEvent(d) {
    if (!d || typeof d !== 'object') return null;
    if (d.t === 'down') return num(d.x, LIMIT) && num(d.y, LIMIT) ? { t: 'down', x: d.x, y: d.y } : null;
    if (d.t === 'revive') return str(d.id, ID_MAX) ? { t: 'revive', id: d.id } : null;
    return null;
}

/** Counts bad messages per peer; after `limit` the peer is ignored for the rest of the session. */
export class Strikes {
    constructor(limit = 20) { this.limit = limit; this.count = new Map(); }
    bad(id) { const n = (this.count.get(id) || 0) + 1; this.count.set(id, n); return n >= this.limit; }
    blocked(id) { return (this.count.get(id) || 0) >= this.limit; }
}
