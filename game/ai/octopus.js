// The octopus (pure, no Phaser; spec 5.0k, world map): on the lagoon floor an octopus crawls
// about its den. Come close and it melts into the sand (camouflage). Dash at it and it squirts a
// cloud of ink and jets away. Stay near it calmly and it grows curious: it flushes bright, waves an
// arm and leaves a few coins. Like the cleaner station it rewards gentle play; nothing hurts.

export const OCTOPUS = {
    x: 52500,            // world x of its den
    roam: 380,           // px it crawls either side of the den
    crawl: 40,           // px/s
    shy: 400,            // px: a fish this close makes it hide in camouflage
    camoIn: 0.45,        // s to melt into the sand ...
    camoOut: 1.6,        // ... and to show itself again
    calmSpeed: 4,        // px/step: slower than this counts as calm
    dash: 9,             // px/step: faster than this within `startle` px makes it ink and flee
    startle: 260,
    curious: 3.2,        // s of calm company before it grows curious
    friendS: 2.2,        // s it shows off
    gift: 3,             // coins it leaves
    jet: 520,            // px it jets away
    jetS: 0.7,
    back: 6              // s before it crawls home after fleeing
};

/** An octopus at its den: { x, home, state ('roam'|'hide'|'friend'|'jet'|'away'), camo 0..1, t, dir, calm, gifted }. */
export function createOctopus(home, cfg = OCTOPUS) {
    return { x: home, home, state: 'roam', camo: 0, t: 0, dir: 1, calm: 0, gifted: false, from: home, to: home };
}

/**
 * One step: `fish` = { dx (fish x - octopus x), dist, speed (px/step) } or null when far.
 * Returns 'ink' (it squirted and jets off), 'friend' (it grew curious: give coins), or null.
 */
export function stepOctopus(o, dt, fish, cfg = OCTOPUS) {
    o.t += dt;
    const near = fish && fish.dist < cfg.shy;
    if (o.state === 'jet') {
        const k = Math.min(1, o.t / cfg.jetS);
        o.x = o.from + (o.to - o.from) * (1 - (1 - k) * (1 - k));
        o.camo = Math.max(0, o.camo - dt / cfg.camoOut);
        if (k >= 1) { o.state = 'away'; o.t = 0; }
        return null;
    }
    if (o.state === 'away') {
        o.camo = Math.min(1, o.camo + dt / cfg.camoIn);
        if (o.t < cfg.back) return null;
        o.state = 'roam'; o.t = 0;
    }
    if (fish && fish.dist < cfg.startle && fish.speed > cfg.dash) {
        o.state = 'jet'; o.t = 0; o.calm = 0; o.from = o.x;
        o.to = Math.max(o.home - cfg.roam * 2, Math.min(o.home + cfg.roam * 2, o.x - Math.sign(fish.dx || 1) * cfg.jet));
        return 'ink';
    }
    if (o.state === 'friend') {
        o.camo = Math.max(0, o.camo - dt / 0.3);
        if (o.t > cfg.friendS) { o.state = near ? 'hide' : 'roam'; o.t = 0; }
        return null;
    }
    if (near) {
        o.state = 'hide';
        o.camo = Math.min(1, o.camo + dt / cfg.camoIn);
        o.calm = fish.speed < cfg.calmSpeed ? o.calm + dt : Math.max(0, o.calm - dt * 2);
        if (o.calm >= cfg.curious && !o.gifted) { o.state = 'friend'; o.t = 0; o.gifted = true; return 'friend'; }
        return null;
    }
    // Nobody about: it shows itself and crawls to and fro by its den.
    o.state = 'roam'; o.calm = 0;
    o.camo = Math.max(0, o.camo - dt / cfg.camoOut);
    o.x += o.dir * cfg.crawl * dt;
    if (Math.abs(o.x - o.home) > cfg.roam) { o.x = o.home + Math.sign(o.x - o.home) * cfg.roam; o.dir = -o.dir; }
    return null;
}
