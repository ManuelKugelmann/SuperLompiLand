// Thin transport over Trystero (WebRTC data channels, peer discovery through
// public relays). Everything else talks only to this class, so the transport
// can be swapped (e.g. for a WebSocket relay) without touching game code.
//
// Privacy: the app id and room code are the only things that reach the public
// relays. Keep both generic — no project, personal or studio names — and send
// no free text over the wire (kids' game): room codes and fish state only.
import { joinRoom } from 'trystero';

const APP_ID = 'reef-swim-pals-v1';

// Readable, no vowels (no accidental words), no look-alikes (0/O, 1/I).
const CODE_CHARS = 'BCDFGHJKLMNPQRSTVWXZ2346789';
export const CODE_LENGTH = 4;

export function makeRoomCode() {
    let s = '';
    for (let i = 0; i < CODE_LENGTH; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return s;
}

export function cleanRoomCode(input) {
    return String(input || '').toUpperCase().split('').filter(c => CODE_CHARS.includes(c)).join('').slice(0, CODE_LENGTH);
}

export default class Net {
    constructor(code) {
        this.code = code;
        this.peers = new Set();
        this.joinCbs = [];
        this.leaveCbs = [];
        this.msgCbs = [];
        // ?anon in the URL = throwaway identity, so two tabs of one browser
        // profile count as two players (local testing).
        const anon = typeof location !== 'undefined' && /[?&]anon\b/.test(location.search);
        this.room = joinRoom(anon ? { appId: APP_ID, identity: 'none' } : { appId: APP_ID }, `room-${code}`);
        this.state = this.room.makeAction('fish');
        this.state.onMessage((data, ctx) => this.msgCbs.forEach(cb => cb(ctx.userId, data)));
        this.room.onUserJoin(({ userId }) => {
            this.peers.add(userId);
            this.joinCbs.forEach(cb => cb(userId));
        });
        this.room.onUserLeave(({ userId }) => {
            this.peers.delete(userId);
            this.leaveCbs.forEach(cb => cb(userId));
        });
    }

    onJoin(cb) { this.joinCbs.push(cb); }
    onLeave(cb) { this.leaveCbs.push(cb); }
    onState(cb) { this.msgCbs.push(cb); }

    /** Broadcast a small JSON-able snapshot to everyone in the room. */
    send(data) {
        if (this.peers.size === 0) return;
        this.state.send(data).catch(() => { /* peer vanished mid-send: ignore */ });
    }

    leave() {
        this.joinCbs = this.leaveCbs = this.msgCbs = [];
        this.peers.clear();
        return this.room.leave();
    }
}
