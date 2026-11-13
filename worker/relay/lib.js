// Room relay logic, free of Cloudflare APIs — unit-tested in tests/relay.test.mjs.
// worker.js runs one RoomCore per Durable Object (one per room hash).
//
// Wire format (JSON text frames, client <-> relay):
//   client -> relay   { k: 's', d: <fish state> }     state, ~20 Hz
//                     { k: 'e', d: '<emote id>' }      one-shot emote
//   relay -> client   { k: 'hello', id, peers: [id] }  on connect: your id + who is here
//                     { k: 'join', id } / { k: 'leave', id }
//                     { k: 's' | 'e', from: id, d }    forwarded from another player
//                     { k: 'full' }                    room has MAX_PEERS already (then closed)
//   client -> relay   { k: 'v', d: { t: 'down', x, y } | { t: 'revive', id } }   one-shot event
// The relay never sees room names (only a hash in the URL) and stores nothing.

import { cleanState, cleanEvent } from '../../net/validate.js';

export const RELAY = {
    maxPeers: 4,          // spec: max 4 fish per room
    maxFrameBytes: 1024,  // anything bigger is malformed
    ratePerSec: 40,       // sustained messages per second per client (state 20 Hz + emotes)
    burst: 60,
    strikes: 20           // malformed / over-rate messages before the client is dropped
};

/** Room id in the URL: the client's derived hash, hex only. */
export function validRoom(hash) {
    return typeof hash === 'string' && /^[0-9a-f]{32,128}$/.test(hash);
}

const EMOTES = new Set(['wave', 'heart', 'follow', 'puff']);

/** Parse and check one client frame. Returns { k, d } or null if malformed. */
export function parseFrame(text) {
    if (typeof text !== 'string' || text.length > RELAY.maxFrameBytes) return null;
    let m;
    try { m = JSON.parse(text); } catch { return null; }
    if (!m || typeof m !== 'object') return null;
    if (m.k === 'e') return EMOTES.has(m.d) ? { k: 'e', d: m.d } : null;
    if (m.k === 's') { const d = cleanState(m.d); return d ? { k: 's', d } : null; }
    if (m.k === 'v') { const d = cleanEvent(m.d); return d ? { k: 'v', d } : null; }
    return null;
}

/** Token bucket per client. */
export class Bucket {
    constructor(now = 0, rate = RELAY.ratePerSec, burst = RELAY.burst) {
        this.rate = rate; this.burst = burst; this.tokens = burst; this.t = now;
    }
    take(now) {
        this.tokens = Math.min(this.burst, this.tokens + (now - this.t) / 1000 * this.rate);
        this.t = now;
        if (this.tokens < 1) return false;
        this.tokens -= 1;
        return true;
    }
}

/**
 * One room. `send(conn, obj)` and `close(conn)` are supplied by the host
 * (Durable Object or test server); a conn is any object the host recognises.
 */
export class RoomCore {
    constructor({ send, close, now = () => Date.now(), makeId }) {
        this.send = send; this.close = close; this.now = now;
        this.makeId = makeId || (() => Math.random().toString(36).slice(2, 10));
        this.peers = new Map(); // conn -> { id, bucket, strikes }
    }

    connect(conn) {
        if (this.peers.size >= RELAY.maxPeers) { this.send(conn, { k: 'full' }); this.close(conn); return null; }
        const id = this.makeId();
        const others = [...this.peers.values()].map(p => p.id);
        this.peers.set(conn, { id, bucket: new Bucket(this.now()), strikes: 0 });
        this.send(conn, { k: 'hello', id, peers: others });
        this.broadcast(conn, { k: 'join', id });
        return id;
    }

    /** Re-register a socket that was already in the room (after the host woke from hibernation). */
    adopt(conn, id) {
        if (!this.peers.has(conn)) this.peers.set(conn, { id, bucket: new Bucket(this.now()), strikes: 0 });
    }

    message(conn, text) {
        const p = this.peers.get(conn);
        if (!p) return;
        const m = this.peers.size > 0 && p.bucket.take(this.now()) ? parseFrame(text) : null;
        if (!m) {
            if (++p.strikes >= RELAY.strikes) this.disconnect(conn, true);
            return;
        }
        this.broadcast(conn, { k: m.k, from: p.id, d: m.d });
    }

    disconnect(conn, kick = false) {
        const p = this.peers.get(conn);
        if (!p) return;
        this.peers.delete(conn);
        if (kick) this.close(conn);
        this.broadcast(null, { k: 'leave', id: p.id });
    }

    broadcast(from, obj) {
        for (const conn of this.peers.keys()) if (conn !== from) this.send(conn, obj);
    }
}

/** Is this page allowed to connect? `allowed` = comma-separated origins. */
export function originAllowed(origin, allowed) {
    if (!allowed) return true;
    return String(allowed).split(',').map(s => s.trim()).filter(Boolean).includes(origin);
}
