// The great whale (pure, no Phaser; spec 9.0 "The great whale encounter"). A huge, gentle
// mother with ghost net caught on her drifts slowly along the calm route of the open blue.
// Lompi swims along her body and tears the net off piece by piece: no damage, no timer. Freed,
// she sings, then carries whoever stays at her back east across the blue, and dives away.
// Units: px and s; velocities handed to the fish are px per 60 Hz step.

export const WHALE = {
    length: 1700,        // px nose to fluke
    nets: [0.84, 0.62, 0.38, 0.12],   // where the net pieces hang, as a share of her length from the fluke
    netDrop: [-0.03, 0, -0.02, 0.01],   // ... and how far above (-) or below (+) her middle line, in lengths
    cutRadius: 240,      // px: swimming this close to a piece tears it off
    cutPause: 0.8,       // s before the next piece can come off: one per touch
    drift: 42,           // px/s while she is caught
    waitBehind: 1500,    // px: she stops and waits when the player is this far behind her
    singS: 2.6,          // s she sings before she sets off
    ride: 540,           // px/s on the ride east
    accel: 220,          // px/s² (a whale has momentum)
    seat: [0.55, -0.2],  // where a rider sits: share of her length from the fluke, lengths above her middle
    seatRadius: 520,     // px: this close to the seat you are carried
    grip: 0.14,          // share of the difference to her speed a rider takes on per step
    diveS: 3.2,          // s she takes to dive away at the end
    bob: 26              // px she rises and falls while drifting
};

/** A whale at x on the route; `endX` = where her ride ends. */
export function createWhale(x, endX, cfg = WHALE) {
    return { cfg, x, y: 0, baseX: x, endX, v: cfg.drift, state: 'caught', timer: 0, cut: cfg.nets.map(() => false), left: cfg.nets.length, dive: 0, pause: 0 };
}

/** World place of a spot on her body: `along` = share of her length from the fluke, `off` = lengths from her middle line. */
export function bodySpot(w, along, off, out = { x: 0, y: 0 }) {
    out.x = w.x + (along - 0.5) * w.cfg.length;
    out.y = w.y + off * w.cfg.length;
    return out;
}

const SPOT = { x: 0, y: 0 };

/**
 * Advance by dt. `fish` = { x, y } or null, `routeY(x)` = depth of the calm route, `t` s.
 * Returns 'cut' when a net piece comes off, 'freed' with the last one, 'ride' when she sets
 * off, 'gone' when she has dived away, else null.
 */
export function stepWhale(w, dt, fish, routeY, t = 0) {
    const c = w.cfg;
    let event = null;
    w.timer += dt;
    let want = 0;
    if (w.state === 'caught') {
        want = fish && fish.x < w.x - c.waitBehind ? 0 : c.drift;      // she waits for whoever comes to help
        w.pause -= dt;
        if (fish && w.pause <= 0) {
            for (let i = 0; i < c.nets.length; i++) {
                if (w.cut[i]) continue;
                const s = bodySpot(w, c.nets[i], c.netDrop[i], SPOT);
                if (Math.hypot(s.x - fish.x, s.y - fish.y) < c.cutRadius) {
                    w.cut[i] = true; w.left--; w.pause = c.cutPause;
                    event = w.left === 0 ? 'freed' : 'cut';
                    if (w.left === 0) { w.state = 'sing'; w.timer = 0; }
                    break;
                }
            }
        }
    } else if (w.state === 'sing') {
        if (w.timer >= c.singS) { w.state = 'ride'; w.timer = 0; event = 'ride'; }
    } else if (w.state === 'ride') {
        want = c.ride;
        if (w.x >= w.endX) { w.state = 'dive'; w.timer = 0; }
    } else if (w.state === 'dive') {
        want = c.ride * 0.4;
        w.dive = Math.min(1, w.timer / c.diveS);
        if (w.dive >= 1) { w.state = 'gone'; event = 'gone'; }
    }
    w.v += Math.max(-c.accel * dt, Math.min(c.accel * dt, want - w.v));
    w.x += w.v * dt;
    w.y = routeY(w.x) + Math.sin(t * 0.5) * c.bob + w.dive * w.dive * 900;      // she sinks away in the dive
    return event;
}

/**
 * The velocity a fish near her back takes on during the ride (px per step), or null when it
 * is not carried. Swimming away from the seat lets go: nobody is held.
 */
export function whaleCarry(w, fish, vx, vy, out = { x: 0, y: 0 }) {
    if (w.state !== 'ride') return null;
    const c = w.cfg, s = bodySpot(w, c.seat[0], c.seat[1], SPOT), dx = s.x - fish.x, dy = s.y - fish.y;
    if (Math.hypot(dx, dy) > c.seatRadius) return null;
    // Her speed, plus a soft pull back toward the seat.
    const tx = w.v / 60 + dx * 0.02, ty = dy * 0.02;
    out.x = vx + (tx - vx) * c.grip; out.y = vy + (ty - vy) * c.grip;
    return out;
}
