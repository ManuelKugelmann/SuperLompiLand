// Rainbow sheen on the playables (pure; user 2026-11-14: "rainbow colors on protagonists, have a
// look at lookdev"): like thin film or wet scales, the colour shifts with the angle a card turns to
// the viewer and drifts slowly along it. Strongest on thin fins, a whisper on the body. The result
// multiplies the card's shading (rope vertex tint), so it stays pastel and never darkens much.
// Tested in tests/sheen.test.mjs.

export const SHEEN = {
    roles: { pectoral: 0.6, tail: 0.45, median: 0.5, fan: 0.55, tentacles: 0.55, wing: 0.5, flap: 0.3, flipper: 0.3, curl: 0.25, head: 0 },
    body: 0.1,        // the body's share (faces stay clean)
    floor: 0.5,       // the darkest a rainbow channel multiplies to (pastel)
    angle: 1.3,       // hue turns per unit of the normal's sideways turn
    along: 0.0035,    // hue turns per picture px along the card
    drift: 0.04       // hue turns per second
};

const TAU = Math.PI * 2;

/** Hue parameter of a vertex: its normal's x and y (after yaw), picture place, time (s). */
export const sheenHue = (nx, ny, px, py, t, cfg = SHEEN) => nx * cfg.angle + ny * cfg.angle * 0.5 + (px + py) * cfg.along + t * cfg.drift;

/** Vertex tint (0xRRGGBB) for shading g (0..1), hue h and strength k (0..1). */
export function sheenTint(g, h, k, cfg = SHEEN) {
    if (k <= 0) { const v = Math.round(255 * g); return (v << 16) | (v << 8) | v; }      // no sheen (every animal): plain shading, no cosines
    // Per vertex per frame: no closures, so nothing is left for the garbage collector.
    const f = cfg.floor, a = 255 * g * (1 - k), b = 255 * g * k * (1 - f) * 0.5, base = 255 * g * k * f;
    const r = Math.round(a + base + b * (1 + Math.cos(TAU * h)));
    const gr = Math.round(a + base + b * (1 + Math.cos(TAU * (h + 2 / 3))));
    const bl = Math.round(a + base + b * (1 + Math.cos(TAU * (h + 1 / 3))));
    return (r << 16) | (gr << 8) | bl;
}

/** Strength for a card: a part by its role, the body by SHEEN.body. */
export const sheenFor = role => (role ? (SHEEN.roles[role] ?? 0.2) : SHEEN.body);
