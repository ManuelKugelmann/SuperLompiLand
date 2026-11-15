// Playing together (user 2026-11-15: "multiplayer: start near friend"): whoever has just come into the
// room swims in next to the friend who is already playing, instead of starting far away. Everyone starts
// in the lagoon, so two players who start together are already close and nobody moves. Pure, no Phaser.

export const MEET = {
    windowS: 25,      // s: only a player this new to the room is moved (later, a friend arriving never pulls you away)
    near: 1600,       // px: a friend closer than this is already in sight: no move
    beside: 260       // px: where the newcomer appears, behind the friend
};

/**
 * Where a newcomer should appear, or null to stay. `ageS`: seconds since this player entered the room;
 * `me`, `friend`: { x, y } (friend.vx tells which way it swims, so the newcomer appears behind it).
 */
export function meetSpot(ageS, me, friend, cfg = MEET) {
    if (!friend || ageS > cfg.windowS) return null;
    if (Math.hypot(friend.x - me.x, friend.y - me.y) < cfg.near) return null;
    const behind = (friend.vx || 0) < 0 ? 1 : -1;
    return { x: friend.x + behind * cfg.beside, y: friend.y };
}
