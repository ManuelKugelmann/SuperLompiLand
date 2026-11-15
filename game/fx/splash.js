// How big a splash is (pure, no Phaser; todo "better splashes: splash size by entry speed").
// One size share k (0 for a gentle bob, 1 for a full-speed dive) drives every part: droplets
// thrown up (on an entry most fly out sideways in the two sheets of a crown, the rest straight
// up in a column; on a leap out they trail after the fish), the dent in the springs, a foam
// patch left on the water and the bubbles pulled under. SplashLayer draws it.

export const SPLASH = {
    calm: 2,              // speed (px per step) below which there is no splash at all, only the springs' ripple
    full: 18,             // speed at which a splash is at its biggest
    drops: [5, 44],       // droplets, gentle to full
    up: [280, 980],       // px/s upward throw of a droplet
    side: [80, 300],      // px/s random sideways spread
    carry: 0.35,          // share of the fish's own sideways speed the droplets take along
    crown: 0.65,          // share of an entry's droplets in the crown's two sheets (the rest in the column)
    crownAngle: [0.45, 0.85],   // rad from upright: the sheets lean out more on a big splash
    dent: [1.2, 6],       // spring kick (surface.splash units), entering; a leap out lifts by `lift` of it
    lift: 0.7,
    width: [2, 3.6],      // spring columns the kick spreads over
    foam: { w: [110, 460], grow: [2, 3.6], life: [0.8, 2] },   // foam patch: width px, how far it spreads, seconds
    bubbles: [3, 26],     // bubbles pulled under on an entry
    deep: [40, 190]       // px down to which they are pulled
};

const lerp = (a, b, t) => a + (b - a) * t;
const range = (r, k) => lerp(r[0], r[1], k);

/** 0 (calm) .. 1 (full): how big the splash of something meeting the surface at `speed` px per step is. */
export function splashSize(speed, cfg = SPLASH) {
    const u = Math.min(1, Math.max(0, (speed - cfg.calm) / (cfg.full - cfg.calm)));
    return u * u * (3 - 2 * u);
}

/** The splash's parts, or null below `calm`. */
export function splashShape(speed, entering, cfg = SPLASH) {
    if (speed < cfg.calm) return null;
    const k = splashSize(speed, cfg), drops = Math.round(range(cfg.drops, k));
    return {
        k, entering, drops,
        crown: entering ? Math.round(drops * cfg.crown) : 0,
        up: range(cfg.up, k), side: range(cfg.side, k), lean: range(cfg.crownAngle, k),
        dent: range(cfg.dent, k) * (entering ? 1 : -cfg.lift), width: range(cfg.width, k),
        foam: { w: range(cfg.foam.w, k), grow: range(cfg.foam.grow, k), life: range(cfg.foam.life, k) },
        bubbles: entering ? Math.round(range(cfg.bubbles, k)) : 0, deep: range(cfg.deep, k)
    };
}

/**
 * Droplet i's velocity (px/s, y down) into `out`. Crown drops (i < shape.crown) fly out on alternate sides at the
 * crown's lean; the others go up in a column, carried along by `carryVx` (the fish's sideways speed, px/s).
 */
export function dropVelocity(shape, i, carryVx, rnd, out = {}, cfg = SPLASH) {
    const power = shape.up * (0.55 + 0.45 * rnd());
    if (i < shape.crown) {
        const a = shape.lean * (0.75 + 0.5 * rnd()), side = i % 2 ? 1 : -1;
        out.vx = side * Math.sin(a) * power + carryVx * cfg.carry;
        out.vy = -Math.cos(a) * power;
    } else {
        out.vx = (rnd() * 2 - 1) * shape.side + carryVx * cfg.carry * (shape.entering ? 1 : 1.6);
        out.vy = -power;
    }
    return out;
}
