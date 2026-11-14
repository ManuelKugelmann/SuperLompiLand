// Nothing outside the picture is drawn. The engine sends every visible object to the graphics
// card whether it lies in the view or not; this takes those that lie outside it (plus a margin)
// off the camera, whichever layer they belong to, and puts them back when they come into view.
// It does not touch `visible`: a layer's own showing and hiding keeps working. Only objects that
// sit at their own x, y in the world are judged (pictures, sprites, tile sprites, ropes); screen-
// fixed things, containers, batches and drawings are left alone.

export const VIEW_CULL = {
    pad: 300,                                           // px beyond the view within which things are still drawn
    every: 2,                                           // judged every so many frames (the margin is far more than anything moves in that time)
    kinds: ['Image', 'Sprite', 'TileSprite', 'Rope']    // the kinds of object that are judged
};

/** Whether something at (x, y) that reaches `r` px from there touches the view round (cx, cy) with half size (hw, hh). */
export function touchesView(x, y, r, cx, cy, hw, hh) {
    return Math.abs(x - cx) < hw + r && Math.abs(y - cy) < hh + r;
}

/** How far an object reaches from its own x, y at most: its diagonal covers any origin and turn; a rope's the farthest of its points and its width. */
export function reachOf(o) {
    if (o.points) {
        if (o.cullR === undefined) {
            let far = 0;
            for (const q of o.points) far = Math.max(far, Math.hypot(q.x * o.scaleX, q.y * o.scaleY));
            o.cullR = far * 1.3 + (o.frame?.height || 0) * Math.abs(o.scaleY);      // room for its sway
        }
        return o.cullR;
    }
    return o.displayWidth + o.displayHeight;      // never less than its diagonal
}

/**
 * One pass over a scene's objects: those outside the camera's view are taken off that camera
 * (cameraFilter), those inside put back. `view` = the camera's world view ({ centerX, centerY,
 * width, height }), `camId` = the camera's id. Returns how many are off it now.
 */
export function cullToView(objects, view, camId, cfg = VIEW_CULL) {
    const cx = view.centerX, cy = view.centerY, hw = view.width / 2 + cfg.pad, hh = view.height / 2 + cfg.pad;
    let off = 0;
    for (const o of objects) {
        if (o.cullKind === undefined) o.cullKind = cfg.kinds.includes(o.type);      // found out once per object
        if (!o.cullKind || o.scrollFactorX !== 1 || o.scrollFactorY !== 1 || o.noCull) continue;
        if (touchesView(o.x, o.y, reachOf(o), cx, cy, hw, hh)) o.cameraFilter &= ~camId;
        else { o.cameraFilter |= camId; off++; }
    }
    return off;
}
