// AI v1 for creatures that crawl (starfish, snail, sea slug, urchin; spec 6.2): they move
// along the rock's own outline, pause, turn round at the edge of their patch, and pull in
// when the player bumps them. The outline is the density field's contour, so a crawler is
// always exactly on the rock, whatever its shape.
//
// Pure, no Phaser (tests/crawler.test.mjs). Speeds in px per step (60 per second), times in s.

export const CRAWLER = {
    speed: 0.22,        // px per step along the rock
    range: 240,         // how far from where it started it roams
    crawlS: [4, 11],    // a crawl lasts this long ...
    pauseS: [2, 7],     // ... a pause this long
    bump: 95,           // the player this close makes it pull in
    curlS: 2.4,         // for this long
    probe: 12           // px used to measure the slope of the density field
};

/** Density gradient at (x, y), written into `out` = { x, y }. */
function slope(density, x, y, e, out) {
    out.x = (density(x + e, y) - density(x - e, y)) / (2 * e);
    out.y = (density(x, y + e) - density(x, y - e)) / (2 * e);
    return out;
}

/**
 * Pull (x, y) onto the rock's outline (density == threshold) and note the outward normal.
 * Returns false when the field is too flat there to tell where the outline is.
 */
export function settle(c, density, threshold, cfg = CRAWLER) {
    const g = c.g;
    for (let i = 0; i < 4; i++) {
        slope(density, c.x, c.y, cfg.probe, g);
        const len2 = g.x * g.x + g.y * g.y;
        if (len2 < 1e-10) return false;
        // One Newton step toward the contour, never further than a body length.
        let k = (density(c.x, c.y) - threshold) / len2;
        const move = Math.abs(k) * Math.sqrt(len2);
        if (move > 40) k *= 40 / move;
        c.x -= g.x * k; c.y -= g.y * k;
    }
    slope(density, c.x, c.y, cfg.probe, g);
    const len = Math.hypot(g.x, g.y);
    if (len < 1e-5) return false;
    c.nx = -g.x / len; c.ny = -g.y / len;       // out of the rock, into the water
    return true;
}

/** A crawler near (x, y); it settles onto the rock at once. `traits` may override speed and range. */
export function createCrawler(x, y, density, threshold, traits = {}, seed = 0) {
    const frac = k => { const v = Math.sin(seed * 91.7 + k * 271.3) * 43758.5453; return v - Math.floor(v); };
    const c = {
        speed: CRAWLER.speed, range: CRAWLER.range, ...traits,
        x, y, nx: 0, ny: -1, g: { x: 0, y: 0 }, dir: frac(1) < 0.5 ? -1 : 1,
        state: 'pause', left: 1 + frac(2) * 5, rolls: 3, frac, home: { x, y }, onRock: false
    };
    c.onRock = settle(c, density, threshold);
    c.home.x = c.x; c.home.y = c.y;
    return c;
}

const between = (c, [lo, hi]) => lo + c.frac(c.rolls++) * (hi - lo);

/**
 * One step. env = { density(x, y), threshold, player: { x, y } | null }.
 * States: crawl, pause, curl (pulled in after a bump).
 */
export function stepCrawler(c, dt, env, cfg = CRAWLER) {
    if (!c.onRock) return c;
    c.left -= dt;
    const p = env.player;
    if (p && c.state !== 'curl' && Math.hypot(p.x - c.x, p.y - c.y) < cfg.bump) { c.state = 'curl'; c.left = cfg.curlS; }
    else if (c.left <= 0) {
        c.state = c.state === 'crawl' ? 'pause' : 'crawl';
        c.left = between(c, c.state === 'crawl' ? cfg.crawlS : cfg.pauseS);
        if (c.state === 'crawl' && c.frac(c.rolls++) < 0.3) c.dir = -c.dir;       // sometimes back the way it came
    }
    if (c.state !== 'crawl') return c;

    const steps = dt * 60, x0 = c.x, y0 = c.y, nx0 = c.nx, ny0 = c.ny;
    // Along the outline: at right angles to the normal.
    c.x += -c.ny * c.dir * c.speed * steps; c.y += c.nx * c.dir * c.speed * steps;
    // Stay on the rock; a corner too sharp to follow, or the edge of the patch, turns it round.
    if (!settle(c, env.density, env.threshold, cfg) || c.nx * nx0 + c.ny * ny0 < 0.5) {
        c.x = x0; c.y = y0; c.nx = nx0; c.ny = ny0; c.dir = -c.dir;
    } else if (Math.hypot(c.x - c.home.x, c.y - c.home.y) > c.range) {
        // Heading further out? Turn round (once: it then walks back in).
        if (Math.hypot(x0 - c.home.x, y0 - c.home.y) < Math.hypot(c.x - c.home.x, c.y - c.home.y)) c.dir = -c.dir;
    }
    return c;
}
