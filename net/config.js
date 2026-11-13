// Which multiplayer transport to use.
//
// RELAY_URL empty  -> peer-to-peer (Trystero; signalling over public relays).
// RELAY_URL set    -> our own relay (worker/relay, deploy with `npx wrangler deploy`),
//                     e.g. 'wss://lompi-relay.<account>.workers.dev'.
// A build-time VITE_RELAY_URL overrides it (used for local tests).
export const RELAY_URL = '';

import Net from './Net.js';
import WsNet from './WsNet.js';

export function relayUrl() {
    return import.meta.env?.VITE_RELAY_URL || RELAY_URL;
}

export function openNet(secret) {
    const url = relayUrl();
    return url ? new WsNet(secret, url) : new Net(secret);
}
