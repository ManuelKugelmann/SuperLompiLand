import { DEPTH } from '../depths.js';
import { waveY } from './surface.js';

// A ring of foam where something stands through the water's surface (a pier post): the surface line
// leaves its x range out (surface.addCrossing, Backdrop) and this churned collar sits on the water
// there instead, riding the waves (user: the white line read as a cut through the pier).
export const FOAM_RING = {
    key: 'foam_ring',
    width: 1.5,       // of the post's width
    height: 0.34,     // of the ring's width (a flat ellipse seen from the side)
    sink: 4,          // px its middle sits under the wave line
    alpha: 0.9
};

/** The foam collar texture (once, procedural): a churned ring of white blobs, denser at the sides, softly edged. */
function ensureTexture(scene) {
    if (scene.textures.exists(FOAM_RING.key)) return;
    const W = 256, H = 88, t = scene.textures.createCanvas(FOAM_RING.key, W, H), c = t.getContext();
    let seed = 9; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 260; i++) {
        const a = r() * Math.PI * 2, side = Math.abs(Math.cos(a));
        const rx = W * 0.42 * (0.85 + 0.2 * r()), ry = H * 0.32 * (0.8 + 0.3 * r());
        const x = W / 2 + Math.cos(a) * rx, y = H / 2 + Math.sin(a) * ry, s = 3 + r() * 7 * (0.6 + side);
        const g = c.createRadialGradient(x, y, 0, x, y, s);
        g.addColorStop(0, `rgba(255,255,255,${0.55 + 0.35 * side})`); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, s, 0, Math.PI * 2); c.fill();
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
