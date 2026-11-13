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
//       squash, sound, color, ring   feedback
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
    // Up and forward, made for breaking the surface.
    leap: {
        cooldown: 1100, air: false,
        start: ({ vx, vy, facing }) => ({ vx: vx + facing * 9, vy: Math.min(vy, 0) - 17 })
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

/** May this special start now? */
export function canUse(special, { cooldown, inAir }) {
    return !!special && cooldown <= 0 && (special.air || !inAir);
}
