// Guide fish (pure, no Phaser; spec gamedesign §1.4 "clear path forward").
// When the player makes no progress east for a while, a small friendly fish shows
// up, swims ahead through open water and waits for the player to follow; when the
// player is moving on again it swims off. Never text, never arrows, never pushy:
// ignored, it leaves and only comes back much later.

export const GUIDE = {
    stallS: 20,          // s without new progress before the guide appears
    progressPx: 500,     // px further east than ever before counts as progress
    lead: [450, 800],    // px: how far ahead the next waypoint lies
    followPx: 260,       // player this close to the guide: it moves on
    patienceS: 12,       // s the guide waits at a waypoint before giving up
    cooldownS: 60,       // s before an ignored guide may come back
    maxHops: 5           // waypoints per visit
};

/**
 * @param env  isOpen(x, y) -> true in open water
 * @param random 0..1 generator (seedable for tests)
 */
export function createGuide(env, random = Math.random, opts = {}) {
    const G = { ...GUIDE, ...opts };
    let anchor = -Infinity, stalled = 0, cooldown = 0;   // anchor: x where the stall clock last reset
    let state = 'away', target = null, wait = 0, hops = 0;

    function nextWaypoint(x, y) {
        for (let i = 0; i < 12; i++) {
            const d = G.lead[0] + random() * (G.lead[1] - G.lead[0]);
            const a = (random() - 0.5) * 1.2;                       // ahead, within ~±35° of east
            const tx = x + Math.cos(a) * d, ty = y + Math.sin(a) * d;
            if (env.isOpen(tx, ty) && env.isOpen((x + tx) / 2, (y + ty) / 2)) return { x: tx, y: ty };
        }
        return null;
    }

    return {
        get state() { return state; },          // 'away' | 'lead' | 'leave'
        get target() { return target; },

        /**
         * Call every frame with the player's position. Returns what the guide should do:
         * { state, target } where target is where it swims (null when away).
         */
        update(dt, px, py) {
            cooldown = Math.max(0, cooldown - dt);
            if (anchor === -Infinity || px > anchor + G.progressPx) { anchor = px; stalled = 0; }
            else stalled += dt;

            if (state === 'away') {
                if (stalled >= G.stallS && cooldown <= 0) {
                    target = nextWaypoint(px, py);
                    if (target) { state = 'lead'; wait = 0; hops = 1; }
                }
            } else if (state === 'lead') {
                if (stalled < 1) { state = 'leave'; }                       // moving on again: job done
                else if (Math.hypot(target.x - px, target.y - py) < G.followPx) {
                    const t = hops < G.maxHops ? nextWaypoint(target.x, target.y) : null;
                    if (t) { target = t; hops++; wait = 0; } else state = 'leave';
                } else if ((wait += dt) > G.patienceS) {
                    state = 'leave';
                    cooldown = G.cooldownS;                                  // ignored: come back much later
                }
            }
            return { state, target };
        },

        /** The scene calls this once the leaving guide is out of sight. */
        gone() { state = 'away'; target = null; stalled = 0; }
    };
}
