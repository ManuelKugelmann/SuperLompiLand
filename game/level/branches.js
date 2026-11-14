// Danger branches (pure, no Phaser; spec 5.2c "Danger is optional"): side ways off the calm
// route that a player enters knowingly. The first one is a side cave on the kelp island: a ridge
// of rock lies under the route, a tunnel runs through it from a mouth to an exit further east,
// a current inside carries you along (so it is the faster way), a tangle of net hangs in it,
// and a giant clam with a pearl waits near the far end. The calm route above is untouched.

import { BIOMES } from './biomes.js';

export const BRANCH = {
    biome: 'kelp', at: 0.45,   // which island, and where along it the mouth lies
    length: 1800,       // px from the mouth to the exit
    under: 330,         // px the ridge's top lies under the calm route (below the lane)
    deep: 780,          // px the tunnel's middle lies under the route (a roof of some 200 px of rock above it)
    half: 160,          // half height of the tunnel on average: narrow-ish, room for a fish that is not puffed up
    uneven: 28,         // px its half height varies along the way
    wind: 60,           // px its middle winds up and down
    lean: 150,          // px the mouth and the exit lean toward each other on their way down
    soft: 38,           // px over which rock turns into open water at its walls (a worn edge, no cut)
    mouth: 190,         // half width of the mouth and of the exit, where the tunnel opens upward
    rim: 280,           // px of ridge that stand at full height beyond each funnel
    shoulder: 300,      // px over which the ridge's top rounds off into its flank
    cap: 240,           // px over which the tunnel rounds off at each end
    funnelWear: 34,     // px the funnels' middles wander on their way down
    ends: 420,          // px beyond mouth and exit over which the ridge falls away
    slope: 1.7,         // ... this steeply
    lump: 55,           // px the ridge's top rises and falls (noise added in density.js) ...
    bulge: 170,         // ... and this much its flanks bulge in and out beyond the mouth and the exit
    chamber: [460, 250],   // the clam's chamber near the exit: its length and half height
    net: 0.42,          // where the net tangle hangs, as a share of the tunnel's length
    netUp: 95,          // ... this far above the tunnel's middle, so there is a way under it even when it bobs down
    current: 17,        // px/step the water runs east inside the tunnel (about a stream's speed: it is the faster way)
    coins: 25           // what the pearl is worth
};

/**
 * The side cave for a world whose calm route is `routeY(x)`: where everything is.
 * { x0 (mouth), x1 (exit), ry (route depth there), top (ridge top), y (tunnel middle),
 *   net: { x, y }, clam: { x, y } }
 */
export function sideCave(routeY, cfg = BRANCH) {
    const b = BIOMES.find(bi => bi.id === cfg.biome), x0 = b.from + b.width * cfg.at, x1 = x0 + cfg.length, ry = routeY(x0);
    const cave = { x0, x1, ry, top: ry + cfg.under, y: ry + cfg.deep };
    // The net hangs above the winding middle, the clam lies on the chamber's floor.
    const nx = x0 + cfg.length * cfg.net, cx = x1 - cfg.mouth - cfg.chamber[0] * 0.5;
    cave.net = { x: nx, y: tunnelMid(cave, nx, cfg) - cfg.netUp };
    cave.clam = { x: cx, y: tunnelMid(cave, cx, cfg) + tunnelHalf(cave, cx, cfg) - 50 };
    return cave;
}

/** Depth of the ridge's upper face at x (before its lumps); Infinity away from the cave. */
export function ridgeTop(cave, x, cfg = BRANCH) {
    // The ridge keeps its height for a `rim` beyond each funnel (no spire of rock between funnel
    // and flank), then rounds off into the flank instead of breaking at a corner.
    const past = Math.max(0, cave.x0 - cfg.mouth - cfg.rim - x, x - cave.x1 - cfg.mouth - cfg.rim);
    if (past > cfg.ends * 4) return Infinity;
    const out = past < cfg.shoulder ? past * past / (2 * cfg.shoulder) : past - cfg.shoulder / 2;
    return cave.top + out * cfg.slope;
}

/** Depth of the tunnel's middle at x: it winds a little, like something the water wore out, not a corridor. */
export function tunnelMid(cave, x, cfg = BRANCH) {
    const u = x - cave.x0;
    return cave.y + cfg.wind * (Math.sin(u / 290) * 0.7 + Math.sin(u / 131 + 1.3) * 0.3) * Math.min(1, Math.max(0, u, 0) / 300, Math.max(0, cave.x1 - x) / 300);
}

/** Half height of the open tunnel at x (0 outside it): uneven, and wider in the clam's chamber. */
export function tunnelHalf(cave, x, cfg = BRANCH) {
    if (x < cave.x0 - cfg.mouth || x > cave.x1 + cfg.mouth) return 0;
    const [cl, ch] = cfg.chamber, c = cave.x1 - cfg.mouth - cl / 2, k = Math.max(0, 1 - Math.abs(x - c) / (cl / 2)), u = x - cave.x0;
    const base = cfg.half + cfg.uneven * (Math.sin(u / 173 + 0.4) * 0.6 + Math.sin(u / 71) * 0.4);
    // Rounded ends: the tunnel closes like the end of a pipe worn by water, not with a flat wall.
    const end = Math.min(1, (x - (cave.x0 - cfg.mouth)) / cfg.cap, (cave.x1 + cfg.mouth - x) / cfg.cap), round = Math.sqrt(Math.max(0, end * (2 - end)));
    return (base + (ch - base) * Math.min(1, k * 2) * Math.min(1, k * 2)) * round;
}

/**
 * How far the point (x, y) is from the cave's open water, given the lumpy ridge top there:
 * negative = inside the tunnel, the mouth or the exit (px to the nearest wall), positive = in the
 * ridge's rock (px to the open water), null = above the ridge, none of its business.
 * Mouth and exit are funnels that lean toward each other as they go down, not shafts.
 */
export function caveAt(cave, x, y, top, cfg = BRANCH) {
    if (y < top - 4) return null;
    const half = tunnelHalf(cave, x, cfg), mid = tunnelMid(cave, x, cfg);
    let d = half > 0 ? Math.abs(y - mid) - half : Infinity;
    if (y < cave.y + cfg.half) {
        const down = Math.max(0, y - top) / (cave.y - top);                     // 0 at the ridge's top .. 1 at the tunnel
        // Narrower further down, and worn: the funnel's middle wanders and its width swells and shrinks on the way.
        const width = cfg.mouth * (1 - 0.35 * down) * (1 + 0.14 * Math.sin(y / 67 + 0.8));
        const wander = cfg.funnelWear * Math.sin(y / 96);
        for (const [mx, dir] of [[cave.x0, 1], [cave.x1, -1]]) d = Math.min(d, Math.abs(x - (mx + dir * (cfg.lean * down + wander))) - width);
    }
    return d;
}

/** The current inside the tunnel: water running east (px per step), fading at its walls and ends. */
export function caveFlow(cave, x, y, out = { x: 0, y: 0 }, cfg = BRANCH) {
    out.x = 0; out.y = 0;
    const half = tunnelHalf(cave, x, cfg);
    const mid = tunnelMid(cave, x, cfg);
    if (half <= 0 || Math.abs(y - mid) >= half) return out;
    const ends = Math.min(1, (x - cave.x0) / 300, (cave.x1 - x) / 300);
    if (ends <= 0) return out;
    out.x = cfg.current * ends * (1 - Math.abs(y - mid) / half);
    return out;
}
