// The ghost finger's scripts (pure, no Phaser; spec 9.1 "ghost finger shows the control",
// "tutorial by doing: ghost fingers and icons only"). One short script per control scheme, in
// px relative to an anchor on screen (the fish; for the stick, its resting ring); GhostFinger.js draws it. Tested in tests/ghostDemo.test.mjs.
//
// A script is a list of steps: { d: seconds, at: [x, y] or move: [[x0, y0], [x1, y1]],
//   down (pressing), band ('fish' = elastic band from the fish, or [x, y] = from that point:
//   a stick's base), taps: n quick taps (each with a ring), grow (a long press: a ring
//   that grows), rot: [a0, a1] (the hand rocks, for tilting), fade: 'in' | 'out' }.

export const GHOST = {
    cycles: 2,            // a script is shown this many times, then it bows out
    runs: 2,              // ... on this many first game starts
    key: 'sll_finger_runs'
};

const H = [140, -70], P = [330, -130], ON = [0, -10];   // hold point, pull point, on the fish

export const DEMOS = {
    // Rubber band: press ahead and hold, the band pulls the fish; let go; double tap = special.
    tap: [
        { d: 0.5, move: [[P[0] + 120, P[1] - 60], H], fade: 'in' },
        { d: 0.3, at: H, down: true, taps: 0, grow: false, ring: true },
        { d: 1.2, move: [H, P], down: true, band: 'fish' },
        { d: 0.4, at: P, band: 'fish', fade: 'band' },
        { d: 0.5, move: [P, ON] },
        { d: 0.7, at: ON, taps: 2 },
        { d: 0.6, at: ON, fade: 'out' }
    ],
    // Flap: quick taps ahead of the fish = strokes in that direction; long press = special.
    flap: [
        { d: 0.5, move: [[P[0], P[1] - 80], H], fade: 'in' },
        { d: 1.4, at: H, taps: 4 },
        { d: 0.4, move: [H, ON] },
        { d: 1.0, at: ON, down: true, grow: true },
        { d: 0.6, at: ON, fade: 'out' }
    ],
    // Stick (relative to the stick's resting ring, not the fish): press and drag, the fish swims
    // that way; a quick tap without dragging = special.
    stick: [
        { d: 0.5, move: [[-80, 60], [0, 0]], fade: 'in' },
        { d: 0.3, at: [0, 0], down: true, ring: true },
        { d: 1.2, move: [[0, 0], [150, -80]], down: true, band: [0, 0] },
        { d: 0.4, at: [150, -80], band: [0, 0], fade: 'band' },
        { d: 0.5, move: [[150, -80], [0, 0]] },
        { d: 0.5, at: [0, 0], taps: 1 },
        { d: 0.6, at: [0, 0], fade: 'out' }
    ],
    // Tilt: the hand (the phone) rocks to show steering; taps give speed; long press = special.
    tilt: [
        { d: 0.5, at: H, fade: 'in' },
        { d: 1.6, at: H, rot: [-0.45, 0.45] },
        { d: 1.0, at: H, taps: 3 },
        { d: 0.4, move: [H, ON] },
        { d: 1.0, at: ON, down: true, grow: true },
        { d: 0.6, at: ON, fade: 'out' }
    ]
};

const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const length = steps => steps.reduce((a, s) => a + s.d, 0);

/** Seconds one cycle of a scheme's script takes. */
export const cycleS = scheme => length(DEMOS[scheme] || DEMOS.tap);

/**
 * The demo of `scheme` at time t (s): { x, y } of the fingertip relative to the fish, `down`,
 * `band` (0..1), `bandFrom` ([x, y] relative to the fish), `ring` (0..1 progress or -1),
 * `rot` (rad), `alpha`, and `done` once all cycles have played.
 */
export function fingerAt(t, scheme = 'tap', cfg = GHOST) {
    const steps = DEMOS[scheme] || DEMOS.tap, len = length(steps);
    const out = { x: 0, y: 0, down: false, band: 0, bandFrom: [0, 0], ring: -1, rot: 0, alpha: 1, done: false };
    if (t >= len * cfg.cycles) { out.alpha = 0; out.done = true; return out; }
    let c = t % len, i = 0;
    while (i < steps.length - 1 && c >= steps[i].d) { c -= steps[i].d; i++; }
    const s = steps[i], u = Math.min(1, c / s.d), [a, b] = s.move || [s.at, s.at];
    const k = ease(u);
    out.x = lerp(a[0], b[0], k); out.y = lerp(a[1], b[1], k);
    out.down = !!s.down;
    if (s.band) { out.band = s.fade === 'band' ? 1 - u : 1; out.bandFrom = s.band === 'fish' ? [0, 0] : s.band; }
    if (s.ring) out.ring = u;
    if (s.grow) out.ring = u * 0.999;
    if (s.taps) { const v = u * s.taps, f = v - Math.floor(v); out.down = f < 0.45; out.ring = f; }
    if (s.rot) out.rot = Math.sin(u * Math.PI * 2) * (s.rot[1] - s.rot[0]) / 2;
    if (s.fade === 'in') out.alpha = k;
    if (s.fade === 'out') out.alpha = 1 - u;
    return out;
}

/** Should the demo play on this start? `runs` = how many starts already showed it. */
export const shouldShow = (runs, cfg = GHOST) => (Number(runs) || 0) < cfg.runs;
