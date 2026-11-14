// AI v1 for creatures that swim (spec 6.2 "everyone moves"): a small state machine on top
// of the shared steering. Nothing follows a fixed path:
//
//   wander   roam the home range on a never-repeating course
//   rest     hover in place for a while, breathing
//   notice   the player is near and gentle: slow down, turn and look
//   greet    the player came close: swim up and circle them once
//   flee     the player rushed at it (or burst a special nearby): dart away, then come back
//   breathe  (trait `breathe`, the turtle) every so often: up to the surface, a breath, back down
// A creature with the trait `anchor` (the seahorse) rests holding on to the nearest rock.
//
// Pure, no Phaser (tests/swimmer.test.mjs). Speeds in px per step (60 per second), times in s.

import { angleTo, turnToward, wanderHeading, leash, avoid } from './steering.js';

export const SWIMMER = {
    notice: 430,        // px: the player is noticed from here ...
    greet: 230,         // ... and greeted from here
    orbit: 150,         // radius of the greeting circle
    gentle: 7,          // the player counts as gentle below this speed (px per step)
    rush: 13,           // ... and as rushing above this one, if it comes closer
    scare: 360,         // px within which a rush or a special scares
    fleeS: 1.6,         // how long a fright lasts
    fleeSpeed: 2.6,     // times the creature's own speed
    greetCooldownS: 14, // before the same creature greets again
    restS: [2.5, 6],    // a rest lasts this long ...
    roamS: [6, 16],     // ... a roam between two rests this long
    look: 150,          // how far ahead it checks for rock
    breathEveryS: [35, 70],   // a breather goes up for air this often ...
    breathHoldS: 2.5,         // ... stays at the surface this long ...
    breathGiveUpS: 30,        // ... and gives up after this long if it cannot get there
    surfaceY: 46,             // how deep under the waterline it takes its breath
    anchorReach: 220,         // an anchoring creature looks this far for rock to hold
    anchorRest: 2.5           // ... and then rests this many times longer
};

/** Traits default to a calm reef swimmer; species override what differs. */
const TRAITS = { speed: 1.5, range: 480, turn: 0.045, shy: 1 };

export function createSwimmer(home, traits = {}, seed = 0) {
    const frac = k => { const v = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
    return {
        ...TRAITS, ...traits, seed, home: { x: home.x, y: home.y },
        x: home.x, y: home.y, heading: frac(1) < 0.5 ? 0 : Math.PI, v: 0,
        state: 'wander', left: 4 + frac(2) * 8, cooldown: 0, turned: 0, rolls: 3,
        air: SWIMMER.breathEveryS[0] + frac(4) * (SWIMMER.breathEveryS[1] - SWIMMER.breathEveryS[0]),   // s until the next breath
        hold: null,                              // rock it is holding on to while resting
        lookX: 0, lookY: 0,                      // what it is looking at (for the eyes), 0,0 = ahead
        frac
    };
}

const between = (a, [lo, hi]) => lo + a.frac(a.rolls++) * (hi - lo);

/** The nearest spot of open water right beside rock within `reach` of (x, y), or null. */
export function nearestRock(isOpen, x, y, reach) {
    let best = null;
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2, dx = Math.cos(a), dy = Math.sin(a);
        for (let d = 20; d <= reach && (!best || d < best.d); d += 20) {
            if (!isOpen(x + dx * d, y + dy * d)) { best = { d, x: x + dx * (d - 20), y: y + dy * (d - 20) }; break; }
        }
    }
    return best && { x: best.x, y: best.y };
}

/**
 * One step.
 *   dt      seconds
 *   env     { isOpen(x, y), t (s), player: { x, y, vx, vy } | null, alarm: { x, y } | null }
 * Returns the agent (x, y, heading, v, state updated).
 */
export function stepSwimmer(a, dt, env, cfg = SWIMMER) {
    const p = env.player, steps = dt * 60;
    let dist = Infinity, toPlayer = 0, pSpeed = 0, closing = false;
    if (p) {
        const dx = p.x - a.x, dy = p.y - a.y;
        dist = Math.hypot(dx, dy); toPlayer = Math.atan2(dy, dx);
        pSpeed = Math.hypot(p.vx, p.vy);
        closing = p.vx * dx + p.vy * dy < 0;        // moving toward the creature
    }
    a.cooldown = Math.max(0, a.cooldown - dt);
    a.left -= dt;
    if (a.breathe) a.air -= dt;

    // What now? Frights first, then the player, then its own routine.
    const scare = cfg.scare * a.shy;
    const alarmed = env.alarm && Math.hypot(env.alarm.x - a.x, env.alarm.y - a.y) < scare;
    if (a.state !== 'flee' && (alarmed || (dist < scare && pSpeed > cfg.rush && closing))) {
        a.state = 'flee'; a.left = cfg.fleeS;
    } else if (a.state === 'flee') {
        if (a.left <= 0) { a.state = 'wander'; a.left = between(a, cfg.roamS); a.cooldown = cfg.greetCooldownS * 0.5; }
    } else if (a.state === 'breathe') {
        // At the surface: hold still for a breath, then back to its day. Out of patience: give up.
        if (a.y <= cfg.surfaceY + 8 && a.left > cfg.breathHoldS) a.left = cfg.breathHoldS;
        if (a.left <= 0) { a.state = 'wander'; a.left = between(a, cfg.roamS); a.air = between(a, cfg.breathEveryS); }
    } else if (a.breathe && a.air <= 0) {
        a.state = 'breathe'; a.left = cfg.breathGiveUpS;
    } else if (a.state === 'greet') {
        if (Math.abs(a.turned) >= Math.PI * 2 || dist > cfg.notice) { a.state = 'wander'; a.left = between(a, cfg.roamS); a.cooldown = cfg.greetCooldownS; }
    } else if (dist < cfg.greet && pSpeed < cfg.gentle && a.cooldown <= 0) {
        a.state = 'greet'; a.turned = 0;
    } else if (dist < cfg.notice && pSpeed < cfg.gentle) {
        a.state = 'notice';
    } else if (a.state === 'notice') {
        a.state = 'wander'; a.left = between(a, cfg.roamS);
    } else if (a.left <= 0) {
        a.state = a.state === 'rest' ? 'wander' : 'rest';
        a.left = between(a, a.state === 'rest' ? cfg.restS : cfg.roamS);
        a.hold = null;
        if (a.state === 'rest' && a.anchor) {
            a.hold = nearestRock(env.isOpen, a.x, a.y, cfg.anchorReach);
            if (a.hold) a.left *= cfg.anchorRest;
        }
    }

    // Where to, and how fast.
    let want = a.heading, speed = 0, turn = a.turn;
    if (a.state === 'wander') {
        want = leash(a.x, a.y, a.home, a.range, wanderHeading(env.t, a.seed));
        speed = a.speed;
    } else if (a.state === 'rest' && a.hold) {
        // Swim to the rock and hold on there.
        const dx = a.hold.x - a.x, dy = a.hold.y - a.y;
        if (Math.hypot(dx, dy) > 10) { want = Math.atan2(dy, dx); speed = a.speed * 1.6; turn = a.turn * 2; }
    } else if (a.state === 'breathe') {
        if (a.y > cfg.surfaceY) { want = -Math.PI / 2 + Math.sin(env.t * 0.6 + a.seed) * 0.35; speed = a.speed * 1.2; }
    } else if (a.state === 'notice') {
        want = toPlayer; speed = dist > cfg.greet ? a.speed * 0.25 : 0;      // comes a little closer, keeps a polite distance
    } else if (a.state === 'greet') {
        // Circle the player: head along the circle, corrected toward its radius.
        const tangent = toPlayer - Math.PI / 2, off = (dist - cfg.orbit) / cfg.orbit;
        want = tangent + Math.max(-1, Math.min(1, off)) * 0.9;
        speed = a.speed * 1.5; turn = a.turn * 2.4;
    } else if (a.state === 'flee') {
        const from = env.alarm && alarmed ? Math.atan2(a.y - env.alarm.y, a.x - env.alarm.x) : toPlayer + Math.PI;
        want = p || env.alarm ? from : a.heading;
        speed = a.speed * cfg.fleeSpeed; turn = a.turn * 3;
    }
    // Going up for air it looks only a little way ahead: the waterline itself is not a wall to steer round.
    if (speed > 0) want = avoid(env.isOpen, a.x, a.y, want, a.state === 'breathe' ? Math.min(cfg.look, 30) : cfg.look);
    const before = a.heading;
    a.heading = turnToward(a.heading, want, turn * steps);
    if (a.state === 'greet') a.turned += angleTo(before, a.heading);
    a.v += (speed - a.v) * Math.min(1, 0.06 * steps);
    const nx = a.x + Math.cos(a.heading) * a.v * steps, ny = a.y + Math.sin(a.heading) * a.v * steps;
    if (env.isOpen(nx, ny)) { a.x = nx; a.y = ny; } else a.v = 0;      // never into rock

    const watching = a.state === 'notice' || a.state === 'greet';
    a.lookX = watching ? Math.cos(toPlayer) : 0; a.lookY = watching ? Math.sin(toPlayer) : 0;
    return a;
}
