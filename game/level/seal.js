// The sleeping harbour seal (pure, no Phaser; spec 5.0o): in the harbour a seal sleeps upright in
// the water, a little over the lane (seals sleep under water like that, drifting, and only come
// up for a breath). When the fish comes near, its eyes open and its head turns after the fish;
// when the fish has gone, it sleeps again.

import { BIOMES } from './biomes.js';

export const SEAL = {
    biome: 'harbour',
    at: 0.795,           // share of the biome's width where it sleeps (the stretch after the harbour's friend)
    above: 230,          // px over the calm route its middle hangs
    height: 330,         // px tall (upright; about two fish)
    wake: 430,           // px from it at which it wakes
    sleepS: 2.2,         // s after the fish has gone before its eyes close again
    turn: 0.7,           // rad its head turns to either side at most
    turnS: 0.35,         // s its head takes to follow
    bob: 12,             // px it drifts up and down in its sleep
    breathS: 3.4,        // s between two bubbles from its nose while it sleeps
    near: 2400,          // px from the fish within which it exists
    seen: 500            // px at which it goes into the reef book
};

/** Where it sleeps: { x, x0, x1 }. */
export function sealSpot(cfg = SEAL) {
    const b = BIOMES.find(bi => bi.id === cfg.biome), x = b.from + b.width * cfg.at;
    return { x, x0: x - 300, x1: x + 300 };
}

/** A new seal: asleep, head straight. */
export function createSeal() {
    return { awake: false, away: 0, head: 0 };
}

/**
 * One step of `dt` seconds with the fish at (dx, dy) px from the seal's head: it wakes when the
 * fish is within `wake`, sleeps again `sleepS` after the fish has left, and while awake its head
 * turns toward the fish (never further than `turn`). Returns the seal.
 */
export function stepSeal(seal, dx, dy, dt, cfg = SEAL) {
    const near = Math.hypot(dx, dy) < cfg.wake;
    if (near) { seal.awake = true; seal.away = 0; }
    else if (seal.awake && (seal.away += dt) >= cfg.sleepS) seal.awake = false;
    // The head hangs straight down the body's line; the fish's bearing from "straight ahead" (the way the seal faces: +x) is what it turns by.
    const want = seal.awake ? Math.max(-cfg.turn, Math.min(cfg.turn, Math.atan2(dy, Math.abs(dx)) * 0.9)) : 0;
    seal.head += (want - seal.head) * Math.min(1, dt / cfg.turnS);
    seal.side = seal.awake ? (dx < 0 ? -1 : 1) : (seal.side || 1);      // which way it looks
    return seal;
}

/** How far it has drifted up or down at time `t` (s). */
export function sealBob(t, cfg = SEAL) {
    return Math.sin(t * 0.7) * cfg.bob;
}
