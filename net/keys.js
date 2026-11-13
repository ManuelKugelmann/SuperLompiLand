// Room keys, derived on the device from the room name (pure, unit-tested).
// Only these derived values ever leave the device — never the name itself.

// Generic app id + protocol version: part of the salt, so builds with a different
// protocol never meet in the same room (spec ch.13 "Versions").
export const APP_ID = 'reef-swim-pals-v1';

const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

/** normalised name -> { room, password }: 48 + 80 hex chars, PBKDF2-SHA-256, 120k rounds. */
export async function deriveKeys(secret) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(APP_ID), iterations: 120000 }, key, 512);
    const b = new Uint8Array(bits);
    return { room: hex(b.slice(0, 24)), password: hex(b.slice(24, 64)) };
}
