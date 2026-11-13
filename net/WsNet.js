// WebSocket transport to our own relay (worker/relay). Same interface as Net
// (the peer-to-peer transport), so game code does not care which one runs.
import { normalizeSecret } from './secret.js';
import { deriveKeys } from './keys.js';

const BACKOFF_MS = [500, 1000, 2000, 4000, 8000];

export default class WsNet {
    /** status: 'connecting' | 'ready' | 'full' | 'error' */
    constructor(secret, url) {
        this.secret = normalizeSecret(secret);
        this.url = url.replace(/\/+$/, '');
        this.status = 'connecting';
        this.peers = new Set();
        this.joinCbs = []; this.leaveCbs = []; this.msgCbs = []; this.emoteCbs = [];
        this.selfId = null;
        this.ws = null;
        this.tries = 0;
        this.closed = false;
        this.open();
    }

    async open() {
        if (this.closed) return;
        this.status = 'connecting';
        try {
            this.keys ||= await deriveKeys(this.secret);
        } catch { this.status = 'error'; return; }
        if (this.closed) return;
        let ws;
        try { ws = new WebSocket(`${this.url}/room/${this.keys.room}`); } catch { this.retry(); return; }
        this.ws = ws;
        ws.onmessage = ev => this.receive(ev.data);
        ws.onclose = () => {
            if (this.ws !== ws) return;
            this.ws = null;
            for (const id of this.peers) this.leaveCbs.forEach(cb => cb(id));
            this.peers.clear();
            if (this.status !== 'full') this.retry();
        };
        ws.onerror = () => { /* onclose follows */ };
    }

    retry() {
        if (this.closed) return;
        this.status = this.tries >= BACKOFF_MS.length ? 'error' : 'connecting';
        const wait = BACKOFF_MS[Math.min(this.tries++, BACKOFF_MS.length - 1)];
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.open(), wait);
    }

    receive(text) {
        let m;
        try { m = JSON.parse(text); } catch { return; }
        if (m.k === 'hello') {
            this.selfId = m.id;
            this.status = 'ready';
            this.tries = 0;
            for (const id of m.peers || []) { this.peers.add(id); this.joinCbs.forEach(cb => cb(id)); }
        } else if (m.k === 'join') {
            this.peers.add(m.id); this.joinCbs.forEach(cb => cb(m.id));
        } else if (m.k === 'leave') {
            this.peers.delete(m.id); this.leaveCbs.forEach(cb => cb(m.id));
        } else if (m.k === 's') {
            this.msgCbs.forEach(cb => cb(m.from, m.d));
        } else if (m.k === 'e') {
            this.emoteCbs.forEach(cb => cb(m.from, m.d));
        } else if (m.k === 'full') {
            this.status = 'full';
        }
    }

    rejoin() {
        this.tries = 0;
        const ws = this.ws;
        this.ws = null;
        try { ws?.close(); } catch { /* gone */ }
        this.peers.clear();
        return this.open();
    }

    onJoin(cb) { this.joinCbs.push(cb); }
    onLeave(cb) { this.leaveCbs.push(cb); }
    onState(cb) { this.msgCbs.push(cb); }
    onEmote(cb) { this.emoteCbs.push(cb); }

    put(obj) {
        if (this.ws?.readyState === 1 && this.peers.size > 0) this.ws.send(JSON.stringify(obj));
    }
    send(data) { this.put({ k: 's', d: data }); }
    sendEmote(id) { this.put({ k: 'e', d: id }); }

    leave() {
        this.closed = true;
        clearTimeout(this.timer);
        this.joinCbs = []; this.leaveCbs = []; this.msgCbs = []; this.emoteCbs = [];
        this.peers.clear();
        try { this.ws?.close(); } catch { /* gone */ }
        this.ws = null;
        return Promise.resolve();
    }
}
