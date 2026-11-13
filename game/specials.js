// Special moves (double tap / long press / Space). One table, one interface;
// which character has which special is set in characters.js.
//
//   cooldown     ms before the next special, counted from the start
//   endCooldown  ms of cooldown after a pose ends (specials that hold a pose)
//   air          may be started above the water
//   start(ctx)   ctx = { vx, vy, facing, inAir } -> the effect, applied by Player:
//       vx, vy       new velocity
//       pose, poseMs switch to this character state (look + collision size) for a
//                    while; using the special again ends it early
//       guard        ms fully protected (not even pushed)
//       shield       ms hazards cannot hurt
//       invulnerable ms without damage (still pushed)
//       shove        push loose things away
//       squash, sound, color, ring   feedback (ring 0 = no ring)
//   chain        { max, window, rest }: the special may be used up to `max` times in a row,
//                each within `window` ms of the last; after the last one it rests for `rest` ms
//
// Pure data and maths, no Phaser (tests/specials.test.mjs). The numbers are
// first proposals for everything but the puff, to be tuned by play.

const ahead = ({ vx, vy, facing }) => {
    const speed = Math.hypot(vx, vy);
    return speed > 1 ? { x: vx / speed, y: vy / speed } : { x: facing, y: 0 };
};

export const SPECIALS = {
    // Air brake: puff up, stop where you are, briefly untouchable.
    puff: {
        cooldown: 0, endCooldown: 500, air: true,
        start: ({ vx, vy, inAir }) => ({
            pose: 'inflated', poseMs: 2600, guard: 1300, shove: true, squash: -0.3, sound: 'puff', ring: 3.2,
            vx: inAir ? vx : vx * 0.08, vy: inAir ? vy : vy * 0.08
        })
    },
    // Burst forward.
    dash: {
        cooldown: 900, air: false,
        start: c => { const a = ahead(c); return { vx: c.vx + a.x * 15, vy: c.vy + a.y * 15, invulnerable: 350 }; }
    },
    // Sprint: every tap is another burst along the nose, up to five in a row, then a rest.
    sprint: {
        cooldown: 110, air: false, chain: { max: 5, window: 900, rest: 1700 },
        start: c => { const a = ahead(c); return { vx: c.vx + a.x * 7.5, vy: c.vy + a.y * 7.5, invulnerable: 300, squash: 0.22, ring: 0 }; }
    },
    // A flat, fast launch through the surface: more forward than up — the flight after it
    // is a glide (see `glide` in characters.js), not a high jump.
    leap: {
        cooldown: 1100, air: false,
        start: ({ vx, vy, facing }) => ({ vx: vx + facing * 13, vy: Math.min(vy, 0) - 9 })
    },
    // Jellyfish pump.
    pulse: {
        cooldown: 500, air: false,
        start: ({ vx, vy }) => ({ vx: vx * 0.6, vy: Math.min(vy, 0) - 13 })
    },
    // Hazards cannot hurt for a while.
    shield: {
        cooldown: 4200, air: true,
        start: ({ vx, vy }) => ({ vx, vy, shield: 2600, color: 0xffe08a })
    }
};

/**
 * One use of a chained special. `chain` = { count, left } (uses so far, ms left to continue).
 * Returns the new chain state and the cooldown that applies now.
 */
export function chainStep(special, chain) {
    const rule = special.chain;
    if (!rule) return { count: 0, left: 0, cooldown: special.cooldown };
    const count = (chain.left > 0 ? chain.count : 0) + 1;
    if (count >= rule.max) return { count: 0, left: 0, cooldown: rule.rest };
    return { count, left: rule.window, cooldown: special.cooldown };
}

/** May this special start now? */
export function canUse(special, { cooldown, inAir }) {
    return !!special && cooldown <= 0 && (special.air || !inAir);
}
