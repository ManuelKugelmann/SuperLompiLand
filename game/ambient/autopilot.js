// Ambient reef autopilot (pure, no Phaser; spec gamedesign ch.12 "Ambient reef").
// Steers the fish through open water for the meditative background mode: slow
// glides toward points of interest or open water ahead, gentle turns, pauses to
// hover and look, a slow drift east over time; never into rock, never in a hurry.

export const AUTOPILOT = {
    thrust: 0.65,          // thrust strength (0..1 of the player's swim force): a calm cruise
    turnRate: 0.9,         // rad/s the heading may change
    reach: 160,            // px: target counts as reached
    hopMin: 700,           // px: how far the next target lies
    hopMax: 1500,
    eastBias: 0.55,        // 0 = wander anywhere, 1 = always east
    hoverChance: 0.35,     // after reaching a target, chance to hover a while
    hoverS: [2.5, 5],      // s hovering
    stuckS: 7,             // s without progress -> pick a new target
    probes: 10             // tries to find an open-water target
};

/**
 * @param env  isOpen(x, y) -> true in open water; poi(x, y) -> optional {x, y} point of
 *             interest near the fish (a friend, a bubble column, a coral head)
 * @param random  0..1 generator (seedable for tests)
 */
export function createAutopilot(env, random = Math.random, opts = {}) {
    const P = { ...AUTOPILOT, ...opts };
    let target = null, heading = 0, hover = 0, best = Infinity, sinceBest = 0;

    function pickTarget(x, y) {
        const poi = env.poi?.(x, y);
        if (poi && env.isOpen(poi.x, poi.y) && random() < 0.5) return { x: poi.x, y: poi.y };
        for (let i = 0; i < P.probes; i++) {
            const east = random() < P.eastBias;
            const a = east ? (random() - 0.5) * 1.4 : random() * Math.PI * 2;   // east = within ~±40°
            const d = P.hopMin + random() * (P.hopMax - P.hopMin);
            const tx = x + Math.cos(a) * d, ty = y + Math.sin(a) * d * 0.6;    // flatter: less up and down
            if (env.isOpen(tx, ty) && env.isOpen((x + tx) / 2, (y + ty) / 2)) return { x: tx, y: ty };
        }
        return { x: x - Math.cos(heading) * 400, y: y - Math.sin(heading) * 200 };   // nothing open ahead: turn back
    }

    return {
        get target() { return target; },
        get hovering() { return hover > 0; },

        /**
         * One step. Returns the thrust vector {x, y} (length 0..P.thrust) to feed into
         * Player.thrust(); zero while hovering.
         */
        step(dt, x, y) {
            if (!target) { target = pickTarget(x, y); best = Infinity; sinceBest = 0; }
            if (hover > 0) { hover -= dt; return { x: 0, y: 0 }; }
            const dx = target.x - x, dy = target.y - y, dist = Math.hypot(dx, dy);
            if (dist < best - 20) { best = dist; sinceBest = 0; } else sinceBest += dt;
            if (dist < P.reach || sinceBest > P.stuckS) {
                if (dist < P.reach && random() < P.hoverChance) hover = P.hoverS[0] + random() * (P.hoverS[1] - P.hoverS[0]);
                target = null;
                return { x: 0, y: 0 };
            }
            const want = Math.atan2(dy, dx);
            let diff = Math.atan2(Math.sin(want - heading), Math.cos(want - heading));
            const max = P.turnRate * dt;
            heading += Math.max(-max, Math.min(max, diff));
            const ease = Math.min(1, dist / 400);                 // glide in gently
            const s = P.thrust * (0.5 + 0.5 * ease);
            return { x: Math.cos(heading) * s, y: Math.sin(heading) * s };
        },

        /** Point the autopilot along the fish's current direction (no snap at start). */
        face(angle) { heading = angle; }
    };
}
