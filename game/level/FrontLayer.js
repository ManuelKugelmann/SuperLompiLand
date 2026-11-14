import { FRONT_LOOK, frontSlot } from './front.js';

export const FRONT_DRAW = {
    near: 3200, far: 5000,   // px from the seam at which it is built, and beyond which it is removed
    depth: -4.8,             // the dark water: behind the play plane, in front of the far layers
    height: 1500,            // px the haze reaches down from the surface (fading)
    tannin: [58, 40, 8, 0.62],     // mangrove water west of the seam: tea-brown [r, g, b, alpha at its darkest]
    clear: [190, 240, 255, 0.16],  // the clearer water east of it: a faint cool lift
    foamWidth: 1400,         // px of foam line along the surface around the seam
    weed: 4,                 // tufts of weed caught in the foam
    bubbleMs: 120            // a bubble in the jet this often (the jet carries it: it shows the current)
};

/**
 * One picture for both waters (no join at the seam): tea-dark on the west, thinning toward the
 * seam with a sharper change across it, then a faint clear lift on the east fading out; all of
 * it fading downward. Its middle column is the seam.
 */
function ensureTextures(scene) {
    if (scene.textures.exists('front_haze')) return;
    const D = FRONT_DRAW, W = 512, H = 256, t = scene.textures.createCanvas('front_haze', W, H), c = t.getContext();
    const edge = FRONT_LOOK.edge / FRONT_LOOK.haze;
    for (let x = 0; x < W; x++) {
        const u = (x + 0.5) / W * 2 - 1;                              // -1 far west .. 0 the seam .. 1 far east
        const across = Math.min(1, Math.abs(u) / edge);               // 0 at the seam .. 1 past its sharp part
        const [r, g, b, top] = u < 0 ? D.tannin : D.clear;
        const a = top * across * (u < 0 ? 0.35 + 0.65 * Math.min(1, -u * 1.4) : 1 - u);
        const grad = c.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, `rgba(${r},${g},${b},${a})`); grad.addColorStop(0.55, `rgba(${r},${g},${b},${a * 0.75})`); grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
        c.fillStyle = grad; c.fillRect(x, 0, 1, H);
    }
    t.refresh();
}

/**
 * The ocean front in the mangroves (level/front.js is where and its jet): tea-dark water west of
 * the seam, a foam line with weed caught in it at the surface, and bubbles the jet carries east.
 * Built only near the seam. `surfaceY(x)` = the water surface; `onSeen()` once, when first near.
 */
export default class FrontLayer {
    constructor(scene, surfaceY, onSeen) {
        this.scene = scene; this.surfaceY = surfaceY; this.onSeen = onSeen;
        this.slot = frontSlot();
        this.live = null; this.seen = false; this.nextBubble = 0;
    }

    build() {
        const s = this.scene, D = FRONT_DRAW, x = this.slot.x;
        ensureTextures(s);
        const haze = s.add.image(x, 0, 'front_haze').setOrigin(0.5, 0).setDisplaySize(FRONT_LOOK.haze * 2, D.height).setDepth(D.depth);
        const foam = s.textures.exists('foam_line')
            ? s.add.tileSprite(x, 0, D.foamWidth, 40, 'foam_line').setOrigin(0.5, 0.5).setDepth(6.1).setAlpha(0.9)
            : s.add.rectangle(x, 0, D.foamWidth, 10, 0xffffff, 0.7).setDepth(6.1);
        const weed = [];
        for (let i = 0; i < D.weed; i++) {
            if (!s.textures.exists('sargassum')) break;
            const w = s.add.image(x + (i / (D.weed - 1) - 0.5) * D.foamWidth * 0.7, 0, 'sargassum').setOrigin(0.5, 0.36).setDepth(4.8);
            weed.push(w.setScale((170 + 50 * (i % 2)) / w.width).setFlipX(i % 2 === 1));
        }
        return { haze, foam, weed };
    }

    /** Per frame. `fish` = { x, y }, `t` s. */
    update(fish, t) {
        const D = FRONT_DRAW, x = this.slot.x, d = Math.abs(fish.x - x);
        if (this.live && d > D.far) { const v = this.live; v.haze.destroy(); v.foam.destroy(); for (const w of v.weed) w.destroy(); this.live = null; }
        if (!this.live) {
            if (d > D.near || !this.scene.buildSlot()) return;
            this.live = this.build();
        }
        const v = this.live, sy = this.surfaceY(x);
        v.haze.setY(sy);
        v.foam.setY(sy + 4);
        if (v.foam.tilePositionX !== undefined) v.foam.tilePositionX = Math.sin(t * 0.4) * 30;      // it gathers and loosens a little
        for (const w of v.weed) w.setY(this.surfaceY(w.x)).setRotation(Math.sin(t * 0.9 + w.x) * 0.04);
        // Bubbles in the jet, near the seam: the current carries them east.
        if (t > this.nextBubble) {
            this.nextBubble = t + D.bubbleMs / 1000;
            const J = FRONT_LOOK.jet;
            this.scene.particles?.spawn('bubble', x + (Math.random() - 0.7) * J.half, sy + J.top + Math.random() * (J.bottom - J.top) * 0.7, 1, { radius: 7, spread: 10 });
        }
        if (!this.seen && d < 900) { this.seen = true; this.onSeen(); }
    }
}
