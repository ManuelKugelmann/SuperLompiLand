// Room keys, derived on the device from the room name (pure, unit-tested).
// Only these derived values ever leave the device — never the name itself.

// Generic app id + protocol version: part of the salt, so builds with a different
// protocol never meet in the same room (spec ch.13 "Versions").
export const APP_ID = 'reef-swim-pals-v1';

const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

/**
 * Local save key for a room's shared world (spec: keyed by a derived id, no names).
 * Synchronous (FNV-1a, 2 x 32 bit) because the scene needs it while it builds;
 * it only names a localStorage entry on this device, nothing leaves the device.
 */
export function roomStorageKey(secret) {
    const s = `${APP_ID}|${secret}`;
    let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        a = Math.imul(a ^ c, 0x01000193) >>> 0;
        b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
    }
    return `sll_room_${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}

/** normalised name -> { room, password }: 48 + 80 hex chars, PBKDF2-SHA-256, 120k rounds. */
export async function deriveKeys(secret) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(APP_ID), iterations: 120000 }, key, 512);
    const b = new Uint8Array(bits);
    return { room: hex(b.slice(0, 24)), password: hex(b.slice(24, 64)) };
}
