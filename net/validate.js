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

// Shared world (spec: cooperative collecting). Kinds and sizes mirror systems/worldState.js KINDS.
export const WORLD_KINDS = { coin: 64, friend: 16 };
const CHUNK = /^-?\d{1,6},-?\d{1,6}$/;
const B64 = /^[A-Za-z0-9+/]{1,24}={0,2}$/;

/**
 * One-shot events:
 *   { t: 'down', x, y }           a friend has 0 hearts at (x, y)
 *   { t: 'revive', id }           someone touched player `id`'s revive bubble
 *   { t: 'claim', c, k, i }       pickup `i` of kind `k` in chunk `c` was collected
 *   { t: 'sync', e: [[c, k, b64], ...] }   bitfields for a few chunks (OR-merge on arrival)
 */
export function cleanEvent(d) {
    if (!d || typeof d !== 'object') return null;
    if (d.t === 'down') return num(d.x, LIMIT) && num(d.y, LIMIT) ? { t: 'down', x: d.x, y: d.y } : null;
    if (d.t === 'revive') return str(d.id, ID_MAX) ? { t: 'revive', id: d.id } : null;
    if (d.t === 'claim') {
        const size = WORLD_KINDS[d.k];
        if (typeof d.c !== 'string' || !CHUNK.test(d.c) || !size || !Number.isInteger(d.i) || d.i < 0 || d.i >= size) return null;
        return { t: 'claim', c: d.c, k: d.k, i: d.i };
    }
    if (d.t === 'sync') {
        if (!Array.isArray(d.e) || d.e.length === 0 || d.e.length > 16) return null;
        const e = [];
        for (const it of d.e) {
            if (!Array.isArray(it) || it.length !== 3) return null;
            const [c, k, b] = it;
            if (typeof c !== 'string' || !CHUNK.test(c) || !WORLD_KINDS[k] || typeof b !== 'string' || !B64.test(b)) return null;
            e.push([c, k, b]);
        }
        return { t: 'sync', e };
    }
    return null;
}

/** Base64 bitfield -> indices of the set bits (at most `size`). */
export function bitsOf(b64, size) {
    const out = [];
    let s;
    try { s = atob(b64); } catch { return out; }
    for (let byte = 0; byte < Math.min(s.length, size / 8); byte++) {
        const v = s.charCodeAt(byte);
        for (let bit = 0; bit < 8; bit++) if (v & (1 << bit)) out.push(byte * 8 + bit);
    }
    return out;
}

/** WorldState chunks -> sync events small enough for one relay frame each. */
export function syncBatches(chunks, perBatch = 12) {
    const items = [];
    for (const [c, entry] of chunks) {
        if (!CHUNK.test(c)) continue;
        for (const [k, bits] of Object.entries(entry)) {
            if (!WORLD_KINDS[k] || !bits?.some?.(v => v)) continue;
            let s = '';
            for (const v of bits) s += String.fromCharCode(v);
            items.push([c, k, btoa(s)]);
        }
    }
    const out = [];
    for (let i = 0; i < items.length; i += perBatch) out.push({ t: 'sync', e: items.slice(i, i + perBatch) });
    return out;
}

/** Counts bad messages per peer; after `limit` the peer is ignored for the rest of the session. */
export class Strikes {
    constructor(limit = 20) { this.limit = limit; this.count = new Map(); }
    bad(id) { const n = (this.count.get(id) || 0) + 1; this.count.set(id, n); return n >= this.limit; }
    blocked(id) { return (this.count.get(id) || 0) >= this.limit; }
}
