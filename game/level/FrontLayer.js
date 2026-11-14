import Phaser from 'phaser';
import { FRONT_LOOK, frontSlot, jetAt } from './front.js';

export const FRONT_DRAW = {
    near: 3200, far: 5000,   // px from the seam at which it is built, and beyond which it is removed
    depth: 4.6,              // the water itself: over the roots and rock in it (they stand in tea-dark water), behind the fish
    height: 1500,            // px the haze reaches down from the surface (fading)
    tannin: [58, 40, 8, 0.7],     // mangrove water west of the seam: tea-brown [r, g, b, alpha at its darkest]
    clear: [190, 240, 255, 0.28],   // the clearer water east of it: a cool lift
    foamWidth: 640,          // px of foam line along the surface right above the seam
    weed: 4,                 // tufts of weed caught in the foam, over the seam
    weedSpread: 360,         // px they spread over
    seamMs: 70,              // a bubble rising along the seam this often (the line where the waters meet)
    streaks: 14,             // streaks gliding east in the jet (like the current columns)
    streakLen: [180, 360],   // px long
    streakAlpha: 0.35
};

const STREAK = 'front_streak';

/**
 * One picture for both waters (no join at the seam): tea-dark on the west, thinning toward the
 * seam with a sharper change across it, then a faint clear lift on the east fading out; all of
 * it fading downward. Its middle column is the seam.
 */
function ensureTextures(scene) {
    if (!scene.textures.exists(STREAK)) {
        // A thin soft streak, tapered at both ends: water moving fast, seen side-on.
        const W = 256, H = 12, t = scene.textures.createCanvas(STREAK, W, H), c = t.getContext();
        for (let x = 0; x < W; x++) {
            const a = Math.sin(Math.PI * x / (W - 1)) ** 1.5, g = c.createLinearGradient(0, 0, 0, H);
            g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = g; c.fillRect(x, 0, 1, H);
        }
        t.refresh();
    }
    if (scene.textures.exists('front_haze')) return;
    const D = FRONT_DRAW, W = 512, H = 256, t = scene.textures.createCanvas('front_haze', W, H), c = t.getContext();
    const edge = FRONT_LOOK.edge / 2 / FRONT_LOOK.haze;            // each side's share of the seam's width
    for (let x = 0; x < W; x++) {
        const u = (x + 0.5) / W * 2 - 1;                              // -1 far west .. 0 the seam .. 1 far east
        const across = Math.min(1, Math.abs(u) / edge);               // 0 at the seam .. 1 past its sharp part
        const [r, g, b, top] = u < 0 ? D.tannin : D.clear;
        // Full strength right up to the seam (fronts are sharp lines of colour), thinning far off.
        const a = top * across * (u < 0 ? 1 - 0.35 * Math.max(0, -u - 0.5) / 0.5 : 1 - 0.7 * u);
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
const JET = { x: 0, y: 0 };

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
            const w = s.add.image(x + (i / (D.weed - 1) - 0.5) * D.weedSpread, 0, 'sargassum').setOrigin(0.5, 0.36).setDepth(4.8);
            weed.push(w.setScale((170 + 50 * (i % 2)) / w.width).setFlipX(i % 2 === 1));
        }
        // Streaks in the jet: each glides east at the jet's speed where it is, and comes round again.
        const J = FRONT_LOOK.jet, streaks = [];
        for (let i = 0; i < D.streaks; i++) {
            const len = D.streakLen[0] + (i * 0.37 % 1) * (D.streakLen[1] - D.streakLen[0]);
            const img = s.add.image(0, 0, STREAK).setDepth(4.7).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(len, 10);
            streaks.push({ img, u: (i * 0.618) % 1, depth: J.top + 30 + ((i * 0.381) % 1) * (J.bottom - J.top - 120) });
        }
        return { haze, foam, weed, streaks };
    }

    /** Per frame. `fish` = { x, y }, `t` s, `delta` ms. */
    update(fish, t, delta = 16.7) {
        const D = FRONT_DRAW, x = this.slot.x, d = Math.abs(fish.x - x);
        if (this.live && d > D.far) { const v = this.live; v.haze.destroy(); v.foam.destroy(); for (const w of v.weed) w.destroy(); for (const k of v.streaks) k.img.destroy(); this.live = null; }
        if (!this.live) {
            if (d > D.near || !this.scene.buildSlot()) return;
            this.live = this.build();
        }
        const v = this.live, sy = this.surfaceY(x);
        v.haze.setY(sy);
        v.foam.setY(sy + 4);
        if (v.foam.tilePositionX !== undefined) v.foam.tilePositionX = Math.sin(t * 0.4) * 30;      // it gathers and loosens a little
        for (const w of v.weed) w.setY(this.surfaceY(w.x)).setRotation(Math.sin(t * 0.9 + w.x) * 0.04);
        // A line of bubbles rising along the seam: where the waters meet.
        if (t > this.nextBubble) {
            this.nextBubble = t + D.seamMs / 1000;
            this.scene.particles?.spawn('bubble', x + (Math.random() - 0.5) * 40, sy + 60 + Math.random() * 900, 1, { radius: 6, spread: 6 });
        }
        // Streaks in the jet, gliding east and fading where it weakens.
        const J = FRONT_LOOK.jet, span = J.half * 2, steps = delta / (1000 / 60);
        for (const k of v.streaks) {
            const sx = x - J.half + k.u * span, y = sy + k.depth;
            jetAt(sx, y, sy, JET);
            k.u = (k.u + (JET.x + 2) * steps / span) % 1;
            k.img.setPosition(sx, y).setAlpha(D.streakAlpha * Math.min(1, JET.x / (J.push * 0.6)));
        }
        if (!this.seen && d < 900) { this.seen = true; this.onSeen(); }
    }
}
