import { DEPTH } from '../depths.js';
import { waveY } from './surface.js';

// Foam where something stands through the water's surface (a pier post): the surface line leaves its
// x range out (surface.addCrossing, Backdrop) and a flat, broken patch of foam hugs the post on the
// water instead, riding the waves (user: the white line read as a cut through the pier).
export const FOAM_RING = {
    key: 'foam_patch',
    width: 1.3,       // of the post's width: it hugs the post
    height: 0.24,     // of its width (a flat patch on the water seen from the side)
    sink: 4,          // px its middle sits under the wave line
    alpha: 0.9
};

/**
 * The foam patch texture (once, procedural): a flat, broken patch of churned foam on the water, thickest
 * at the post and toward the swell's side (the left: the swell runs right), thinning out in loose bits,
 * with a few small bubbles. No outline (playtest: a drawn ring read as a hoop floating round the post).
 */
function ensureTexture(scene) {
    if (scene.textures.exists(FOAM_RING.key)) return;
    const W = 256, H = 64, t = scene.textures.createCanvas(FOAM_RING.key, W, H), c = t.getContext();
    let seed = 9; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 420; i++) {
        // Blobs cluster at the middle (the post) and fall off outward, more of them on the swell's side.
        const u = (r() + r() + r()) / 3 * 2 - 1, side = u < 0 ? 1 : 0.6;
        if (r() > side) continue;
        const x = W / 2 + u * W * 0.48, y = H / 2 + (r() - 0.5) * H * 0.55 * (1 - Math.abs(u) * 0.5);
        const s = (2 + r() * 6) * (1 - Math.abs(u) * 0.6), a = (0.35 + 0.5 * r()) * (1 - Math.abs(u) * 0.7) * side;
        const g = c.createRadialGradient(x, y, 0, x, y, s);
        g.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, s, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 14; i++) {         // small bubbles: a light rim, clear inside
        const x = W / 2 + (r() - 0.5) * W * 0.7, y = H / 2 + (r() - 0.5) * H * 0.5, s = 1.5 + r() * 2.5;
        c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, s, 0, Math.PI * 2); c.stroke();
    }
    t.refresh();
}

/**
 * A foam ring at world x around a post `postW` px wide, riding the surface. Returns the picture;
 * its `animate(t)` (seconds) keeps it on the wave line.
 */
export function foamRing(scene, x, postW) {
    ensureTexture(scene);
    const w = postW * FOAM_RING.width;
    const img = scene.add.image(x, 0, FOAM_RING.key).setDisplaySize(w, w * FOAM_RING.height)
        .setDepth(DEPTH.surfaceLine + 0.01).setAlpha(FOAM_RING.alpha);
    img.noCaustics = true;
    img.animate = t => {
        const s = scene.surface;
        img.y = (s?.heightAt ? s.heightAt(x, t) : waveY(x, t)) + FOAM_RING.sink;
        img.rotation = Math.sin(t * 1.3 + x) * 0.03;
    };
    return img;
}
