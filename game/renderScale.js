// The picture's resolution, apart from its layout. The game is laid out in its own px (about
// 1080 tall, scale.width x scale.height) whatever the phone; this draws that same picture into
// a smaller canvas and lets the page stretch it, so a phone whose graphics chip is the limit
// has fewer points to fill. Nothing else changes: scenes, cameras, the HUD and input keep
// counting in the game's px. (Text is painted at full size first, so it stays readable.)

export const RENDER_SCALE = { min: 0.5 };      // never less than this share of the game's px, each way

/** The canvas's size in points for a game of w x h at a share `k` of its px (whole numbers, never under the least share). */
export function canvasSize(w, h, k, cfg = RENDER_SCALE) {
    const share = Math.max(cfg.min, Math.min(1, k > 0 ? k : 1));
    return { width: Math.round(w * share), height: Math.round(h * share) };
}

/**
 * Draws the game at a share `k` (0.5..1) of its px from now on. The first call hooks into the
 * game: whenever the picture is sized anew (a scene start, a turned phone), the share is put
 * on again right after the engine has set its own full size.
 */
export function setRenderScale(game, k) {
    const first = game.renderShare === undefined;
    game.renderShare = k;
    if (game.renderer.type !== 2) return;      // WebGL only: the canvas renderer has no projection to keep
    if (first) {
        const base = game.scale.baseSize;
        // The engine puts its projection back to the canvas's points after drawing into a texture: it is the game's px that count.
        game.renderer.resetProjectionMatrix = function () { this.setProjectionMatrix(base.width, base.height); };
        game.scale.on('resize', () => apply(game));
    }
    apply(game);
}

function apply(game) {
    const base = game.scale.baseSize, size = canvasSize(base.width, base.height, game.renderShare), canvas = game.canvas;
    if (canvas.width === size.width && canvas.height === size.height && game.renderer.width === size.width) return;
    canvas.width = size.width; canvas.height = size.height;
    game.renderer.resize(size.width, size.height);
    game.renderer.setProjectionMatrix(base.width, base.height);
}
