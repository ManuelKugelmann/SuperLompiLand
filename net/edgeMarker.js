// Where to show a friend who is off screen (pure, unit-tested).

/** Inset from each screen edge (px). The top clears the HUD buttons, journey strip and room badge; the right clears the emote buttons. */
export const MARKER_INSET = { top: 250, right: 205, bottom: 70, left: 70 };

/**
 * `view` = the camera's world rectangle { x, y, width, height }, `target` = the
 * friend's world position. Returns null when the friend is visible; otherwise the
 * screen position (camera-relative, inside the inset box) on the ray from the
 * screen centre towards the friend, plus the angle pointing at them.
 */
export function edgeMarker(view, target, inset = MARKER_INSET) {
    const inside = target.x >= view.x && target.x <= view.x + view.width
        && target.y >= view.y && target.y <= view.y + view.height;
    if (inside) return null;
    const cx = view.width / 2, cy = view.height / 2;
    const dx = target.x - (view.x + cx), dy = target.y - (view.y + cy);
    // How far along the ray until it meets the inset box.
    const kx = dx > 0 ? (view.width - inset.right - cx) / dx : dx < 0 ? (inset.left - cx) / dx : Infinity;
    const ky = dy > 0 ? (view.height - inset.bottom - cy) / dy : dy < 0 ? (inset.top - cy) / dy : Infinity;
    const k = Math.min(kx, ky);
    return { x: cx + dx * k, y: cy + dy * k, angle: Math.atan2(dy, dx), distance: Math.hypot(dx, dy) };
}
