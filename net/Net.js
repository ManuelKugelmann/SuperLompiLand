// Thin transport over Trystero (WebRTC data channels, peer discovery through
// public relays). Everything else talks only to this class, so the transport
// can be swapped (e.g. for a WebSocket relay) without touching game code.
//
// Privacy / not discoverable:
//  - A session is a family-chosen secret word. It is stretched locally with
//    PBKDF2 into an unguessable room id plus a separate password; only those
//    derived values ever reach the public relays, never the word itself.
//  - The password encrypts the peer discovery, so outsiders cannot even see
//    the offers, and maxUsers caps the seats. There is no lobby or room list.
//  - The app id is generic: no project, personal or studio names.
//  - Only fish state goes over the wire — no chat, no free text.
import { joinRoom } from 'trystero';

const APP_ID = 'reef-swim-pals-v1';
export const MAX_PLAYERS = 6;
export const MIN_SECRET = 6;
export const MAX_SECRET = 20;

/** Lower-case letters and digits only, accents folded (ä -> a), so "Müller" == "muller". */
export function normalizeSecret(input) {
    return String(input || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, MAX_SECRET);
}

/** A pronounceable random secret (consonant + vowel pairs), easy to say aloud. */
export function makeSecret() {
    const C = 'bdfgklmnprstvz', V = 'aeiou';
    let s = '';
    for (let i = 0; i < 4; i++) {
        s += C[Math.floor(Math.random() * C.length)] + V[Math.floor(Math.random() * V.length)];
    }
    return s;
}

const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

/** secret -> { room, password }, derived on this device. */
async function derive(secret) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(APP_ID), iterations: 120000 }, key, 512);
    const b = new Uint8Array(bits);
    return { room: hex(b.slice(0, 24)), password: hex(b.slice(24, 64)) };
}

export default class Net {
    /** status: 'connecting' | 'ready' | 'full' | 'error' */
    constructor(secret) {
        this.secret = normalizeSecret(secret);
        this.status = 'connecting';
        this.peers = new Set();
        this.joinCbs = [];
        this.leaveCbs = [];
        this.msgCbs = [];
        this.room = null;
        this.gen = 0; // bumped on every (re)join so late async results are ignored
        this.keys = null;
        this.open();
    }

    async open() {
        const gen = ++this.gen;
        this.status = 'connecting';
        try {
            this.keys ||= await derive(this.secret);
            if (gen !== this.gen) return;
            // ?anon in the URL = throwaway identity, so two tabs of one browser
            // profile count as two players (local testing).
            const anon = typeof location !== 'undefined' && /[?&]anon\b/.test(location.search);
            const cfg = { appId: APP_ID, password: this.keys.password, maxUsers: MAX_PLAYERS };
            if (anon) cfg.identity = 'none';
            // Optional TURN relay for networks where direct peer-to-peer is
            // blocked (symmetric NAT, some mobile carriers). Set at build time:
            //   VITE_TURN_URLS=turn:host:3478,turns:host:443 VITE_TURN_USER=... VITE_TURN_PASS=...
            // Without it the game still uses STUN and works on most home networks.
            const turnUrls = import.meta.env?.VITE_TURN_URLS;
            if (turnUrls) {
                cfg.turnConfig = [{
                    urls: turnUrls.split(',').map(u => u.trim()).filter(Boolean),
                    username: import.meta.env.VITE_TURN_USER, credential: import.meta.env.VITE_TURN_PASS
                }];
            }
            const room = joinRoom(cfg, this.keys.room);
            this.room = room;
            this.state = room.makeAction('fish');
            this.state.onMessage((data, ctx) => { if (gen === this.gen) this.msgCbs.forEach(cb => cb(ctx.userId, data)); });
            room.onUserJoin(({ userId }) => {
                if (gen !== this.gen) return;
                this.peers.add(userId);
                this.joinCbs.forEach(cb => cb(userId));
            });
            room.onUserLeave(({ userId }) => {
                if (gen !== this.gen) return;
                this.peers.delete(userId);
                this.leaveCbs.forEach(cb => cb(userId));
            });
            room.onError(err => {
                if (gen !== this.gen) return;
                if (err.code === 'room-full') this.status = 'full';
            });
            await room.ready;
            if (gen === this.gen && this.status === 'connecting') this.status = 'ready';
        } catch {
            if (gen === this.gen) this.status = 'error';
        }
    }

    /** Leave and join again (network came back, device woke up): the same session, a fresh connection. */
    async rejoin() {
        const old = this.room;
        this.room = null;
        this.peers.clear();
        try { await old?.leave(); } catch { /* already gone */ }
        return this.open();
    }

    onJoin(cb) { this.joinCbs.push(cb); }
    onLeave(cb) { this.leaveCbs.push(cb); }
    onState(cb) { this.msgCbs.push(cb); }

    /** Broadcast a small JSON-able snapshot to everyone in the session. */
    send(data) {
        if (!this.room || this.peers.size === 0) return;
        this.state.send(data).catch(() => { /* peer vanished mid-send: ignore */ });
    }

    leave() {
        this.gen++;
        this.joinCbs = []; this.leaveCbs = []; this.msgCbs = [];
        this.peers.clear();
        const room = this.room;
        this.room = null;
        return room ? room.leave().catch(() => {}) : Promise.resolve();
    }
}
