// Tilt steering's maths (pure, no Phaser, no browser): from the device's orientation to a
// steering direction on the screen. It works with the direction of gravity in the device's own
// axes, not with the two tilt angles themselves: those jump and swap roles when the phone is held
// upright instead of flat, which is how a child holds it. The fish goes toward the edge of the
// SCREEN that is tilted down, like a marble on a tray, measured from how the phone was held when
// steering began (the neutral pose).

export const TILT = {
    fullDeg: 22,      // degrees of tilt from the neutral pose for full deflection
    dead: 0.12        // share of full tilt that is ignored
};

const RAD = Math.PI / 180;

/** The direction gravity pulls, in the device's axes (x right, y toward its top edge, z out of the screen), from deviceorientation's beta and gamma (degrees). */
export function gravityFromAngles(beta, gamma) {
    const b = beta * RAD, g = gamma * RAD;
    return { x: Math.cos(b) * Math.sin(g), y: -Math.sin(b), z: -Math.cos(b) * Math.cos(g) };
}

/** The same from devicemotion's accelerationIncludingGravity (m/s²). `ios`: the two platforms report it with opposite sign. */
export function gravityFromMotion(ax, ay, az, ios) {
    const k = ios ? 1 : -1, len = Math.hypot(ax, ay, az) || 1;
    return { x: ax * k / len, y: ay * k / len, z: az * k / len };
}

/**
 * The screen's "right" and "down" in the device's axes: `angle` = how the system has turned the
 * page (screen.orientation.angle: 0, 90, 180, 270), `rotated` = the game draws itself turned a
 * further quarter (a portrait screen shows the landscape game sideways).
 * Returns { right: { x, y }, down: { x, y } } (unit vectors in the device's screen plane).
 */
export function screenAxes(angle, rotated = false) {
    const a = ((angle % 360) + 360) % 360;
    const page = a === 90 ? { right: { x: 0, y: -1 }, down: { x: -1, y: 0 } }
        : a === 270 ? { right: { x: 0, y: 1 }, down: { x: 1, y: 0 } }
            : a === 180 ? { right: { x: -1, y: 0 }, down: { x: 0, y: 1 } }
                : { right: { x: 1, y: 0 }, down: { x: 0, y: -1 } };
    // The game turned a quarter on the page: its right is the page's down, its down the page's left.
    return rotated ? { right: page.down, down: { x: -page.right.x || 0, y: -page.right.y || 0 } } : page;
}

/**
 * The steering direction on the screen for gravity `g` (unit vector), measured from the neutral
 * pose `g0`: x toward the screen's right edge, y toward its bottom edge, each -1..1 at `fullDeg`
 * of tilt and beyond, nothing inside the dead zone. Left and right come from how far gravity has
 * moved along the screen's right; up and down from how far it has moved along the axis at right
 * angles to both that and the neutral gravity: on a flat phone that is the screen's own down, on
 * an upright one it is tipping the top edge toward or away from the player.
 * Into `out` ({ x, y }).
 */
export function tiltDir(g, g0, axes, out = {}, cfg = TILT) {
    const r = { x: axes.right.x, y: axes.right.y, z: 0 };
    // e = g0 x r, turned so that it points along the screen's down as far as it can (and out of the screen's back when the phone is upright).
    let ex = g0.y * r.z - g0.z * r.y, ey = g0.z * r.x - g0.x * r.z, ez = g0.x * r.y - g0.y * r.x;
    const el = Math.hypot(ex, ey, ez) || 1;
    ex /= el; ey /= el; ez /= el;
    if (ex * axes.down.x + ey * axes.down.y < 0 || (Math.abs(ex * axes.down.x + ey * axes.down.y) < 1e-6 && ez > 0)) { ex = -ex; ey = -ey; ez = -ez; }
    const dx = g.x - g0.x, dy = g.y - g0.y, dz = g.z - g0.z, full = Math.sin(cfg.fullDeg * RAD);
    let x = (dx * r.x + dy * r.y) / full, y = (dx * ex + dy * ey + dz * ez) / full;
    const len = Math.hypot(x, y);
    if (len < cfg.dead) { out.x = 0; out.y = 0; return out; }
    const k = Math.min(1, (len - cfg.dead) / (1 - cfg.dead)) / len;
    out.x = x * k; out.y = y * k;
    return out;
}
