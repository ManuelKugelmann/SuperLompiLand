// Where to show a friend who is off screen (pure, unit-tested).

/**
 * `view` = the camera's world rectangle { x, y, width, height }, `target` = the
 * friend's world position. Returns null when the friend is visible; otherwise the
 * screen position (camera-relative, kept `margin` px inside the edge) on the line
 * from the screen centre towards the friend, plus the angle pointing at them.
 */
export function edgeMarker(view, target, margin = 70) {
    const inside = target.x >= view.x && target.x <= view.x + view.width
        && target.y >= view.y && target.y <= view.y + view.height;
    if (inside) return null;
    const hw = view.width / 2 - margin, hh = view.height / 2 - margin;
    const dx = target.x - (view.x + view.width / 2), dy = target.y - (view.y + view.height / 2);
    // Scale the direction so it touches the inner box.
    const k = Math.min(hw / Math.max(Math.abs(dx), 1e-6), hh / Math.max(Math.abs(dy), 1e-6));
    return {
        x: view.width / 2 + dx * k,
        y: view.height / 2 + dy * k,
        angle: Math.atan2(dy, dx),
        distance: Math.hypot(dx, dy)
    };
}
