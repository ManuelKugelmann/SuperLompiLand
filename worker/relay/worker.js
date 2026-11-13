// Multiplayer relay (Cloudflare Worker + one Durable Object per room hash).
//
//   wss://<worker>/room/<hash>   join the room with that hash (WebSocket)
//
// The game derives <hash> from the room name on the device, so the relay never
// sees names, keeps nothing, and cannot list rooms. Rooms vanish when empty.
// Settings (wrangler.toml [vars]):
//   ALLOWED_ORIGINS  comma-separated page origins that may connect (empty = any)
// Binding: Durable Object ROOMS (class Room).
import { RoomCore, validRoom, originAllowed } from './lib.js';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const m = /^\/room\/([^/]+)$/.exec(url.pathname);
        if (!m || !validRoom(m[1])) return new Response('not found', { status: 404 });
        if (request.headers.get('Upgrade') !== 'websocket') return new Response('websocket only', { status: 426 });
        if (!originAllowed(request.headers.get('Origin') || '', env.ALLOWED_ORIGINS)) return new Response('forbidden', { status: 403 });
        return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(request);
    }
};

export class Room {
    constructor(state) {
        this.state = state;
        // Uses the hibernation API: idle rooms cost nothing. Peer ids live in each
        // socket's attachment, so they survive hibernation; the core is rebuilt.
        this.core = new RoomCore({
            send: (ws, obj) => { try { ws.send(JSON.stringify(obj)); } catch { /* gone */ } },
            close: ws => { try { ws.close(1008, 'bye'); } catch { /* gone */ } }
        });
        for (const ws of state.getWebSockets()) this.restore(ws);
    }

    async fetch() {
        const [client, server] = Object.values(new WebSocketPair());
        this.state.acceptWebSocket(server);
        const id = this.core.connect(server);
        if (id) server.serializeAttachment({ id });
        return new Response(null, { status: 101, webSocket: client });
    }

    webSocketMessage(ws, text) {
        if (!this.core.peers.has(ws)) this.restore(ws);
        this.core.message(ws, typeof text === 'string' ? text : '');
    }

    webSocketClose(ws) { this.core.disconnect(ws); }
    webSocketError(ws) { this.core.disconnect(ws); }

    /** After hibernation the core is new: re-register a socket from its attachment. */
    restore(ws) {
        const a = ws.deserializeAttachment();
        if (a?.id) this.core.adopt(ws, a.id);
    }
}
