// From a creature's mind to what its body shows (pure, no Phaser): the Rig profile of a
// species row, and per frame where the body is, which way it faces, how hard it works.

export const POSE = {
    bob: 0.35,          // share of a species' `bob` it drifts up and down while swimming
    bobRate: 1.3,       // radians per second of that drift
    faceAt: 0.25,       // it only turns round when it heads this clearly the other way (cos of heading)
    curl: 0.78,         // size of a crawler that has pulled in
    puff: 1.18,         // size of a grumpy that is warning
    shakePx: 4,         // ... and how far it trembles
    crawlEffort: 0.35,  // how hard a crawler works while it moves
    alignFrom: 0.2,     // px per step: below this a swimmer stays level ...
    alignFull: 1.2,     // ... from this it tips fully ...
    pitch: 0.45         // ... which is this share of its real climb or dive (animals stay belly-down)
};

/** The Rig profile (what characters.js gives a playable) for a row of the species table. */
export function rigProfile(key, row) {
    return {
        states: { normal: { key, width: row.size, wiggle: row.wiggle ?? 14 } },
        anim: row.anim, soft: row.soft, upright: !!row.upright, facesLeft: !!row.facesLeft,
        alignFrom: POSE.alignFrom, alignFull: POSE.alignFull, pitch: POSE.pitch
    };
}

/**
 * This frame's pose of a creature. `mind` holds whichever of { brain, crawler, grumpy } it has
 * (already stepped), `body` = { x, y, dir, lean, size, lift, bob }; `out` is filled and returned:
 * x, y, vx, vy (px per 60 Hz step), dir (1 right, -1 left), lean, size (target scale), effort 0..1.
 */
export function poseOf(mind, body, t, out) {
    out.x = body.x; out.y = body.y; out.vx = 0; out.vy = 0;
    out.dir = body.dir; out.lean = body.lean; out.size = 1; out.effort = 0;
    const c = mind.crawler, g = mind.grumpy, a = mind.brain;
    if (c) {
        out.x = c.x + c.nx * body.lift; out.y = c.y + c.ny * body.lift;
        out.lean = Math.atan2(c.nx, -c.ny);
        out.size = c.state === 'curl' ? POSE.curl : 1;
        if (c.state === 'crawl') { out.dir = c.dir; out.effort = POSE.crawlEffort; }
    }
    if (g) {
        const warn = g.state === 'warn';
        out.x = g.x + (warn ? Math.sin(t * 60) * POSE.shakePx : 0);
        out.y = g.y + Math.sin(t * POSE.bobRate + g.seed) * body.bob * POSE.bob;
        out.vx = g.vx / 60; out.vy = g.vy / 60;
        out.size = warn ? POSE.puff : 1;
        if (g.heading) out.dir = g.heading > 0 ? 1 : -1;
        out.effort = Math.min(1, Math.hypot(g.vx, g.vy) / g.shoveSpeed + (warn ? 0.6 : 0));
    }
    if (a) {
        const ahead = Math.cos(a.heading);
        if (Math.abs(ahead) > POSE.faceAt) out.dir = ahead > 0 ? 1 : -1;
        out.x = a.x; out.y = a.y + Math.sin(t * POSE.bobRate + a.seed) * body.bob * POSE.bob;
        out.vx = ahead * a.v; out.vy = Math.sin(a.heading) * a.v;
        out.effort = Math.min(1, a.v / (a.speed * 2.5));
    }
    return out;
}
