// Edge steering (pure, no Phaser; user 2026-11-14): "the left and right border of the screen act like
// up-down sticks. The side decides left or right. The middle is full speed straight ahead, the
// corners fully up or down." A thumb resting on either edge slides up and down to steer.

export const EDGE = {
    level: 0.14,      // share of the half height round the middle that swims dead level (a coin line is easy to follow)
    curve: 1.3,       // > 1: the turn grows slowly near the middle and quickly toward the corners
    gauge: 0.06,      // share of the screen width each edge gauge takes on screen
    top: 0.2          // share of the height kept for the HUD line: the edges steer below it, its bottom is "fully up"
};

/**
 * The swim direction for a touch at (x, y) on a W×H screen: { x, y } of length 1 (y down is
 * positive). Left half swims left, right half swims right; the touch's height turns the direction
 * from level (middle) to straight up (top) or straight down (bottom).
 */
export function edgeAim(x, y, W, H, cfg = EDGE) {
    const side = x < W / 2 ? -1 : 1;
    const top = H * cfg.top, mid = (top + H) / 2;                    // the gauges run from under the HUD line to the bottom
    const v = Math.max(-1, Math.min(1, (y - mid) / ((H - top) / 2)));  // -1 top .. 1 bottom
    const a = Math.abs(v), t = a <= cfg.level ? 0 : ((a - cfg.level) / (1 - cfg.level)) ** cfg.curve;
    const angle = Math.sign(v) * t * Math.PI / 2;
    return { x: side * Math.cos(angle), y: Math.sin(angle) };
}
