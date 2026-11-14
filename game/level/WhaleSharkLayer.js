import { createRig } from '../CardRig.js';
import { SHARK, whaleSharkSlot, sharkAt } from './whaleShark.js';

export const WHALE_SHARK_LOOK = {
    near: 3200, far: 5200,   // px from its stretch at which it is built, and beyond which it is removed
    depth: 3.6,              // behind the fish, with the shoals
    bubbleMs: 90,            // a bubble in its slipstream this often (the water carries it along: it shows the lane)
    seen: 900                // px: this close, it goes into the reef book
};

/** The painted whale shark (loaded by the title screen); its part cards come with the others (CardRig.loadParts). */
export const WHALE_SHARK_ART = { whale_shark: 'img/whale_shark.webp' };

/**
 * The whale shark in the world (level/whaleShark.js is where it goes and its slipstream): one
 * card rig, built only near its stretch. `pose` is this frame's place for MainScene.waterAt
 * (null while it is not built). `onSeen()` is called once, when the fish first comes close.
 */
export default class WhaleSharkLayer {
    constructor(scene, routeY, onSeen) {
        this.scene = scene; this.routeY = routeY; this.onSeen = onSeen;
        this.slot = whaleSharkSlot();
        this.rig = null; this.pose = null; this.seen = false; this.nextBubble = 0;
    }

    /** Per frame. `fish` = { x, y }, `t` s, `delta` ms. */
    update(fish, t, delta) {
        const L = WHALE_SHARK_LOOK, s = this.slot, near = fish.x > s.x0 - L.near && fish.x < s.x1 + L.near;
        if (!near) {
            if (this.rig && (fish.x < s.x0 - L.far || fish.x > s.x1 + L.far)) { this.rig.destroy(); this.rig = null; }
            this.pose = null;
            return;
        }
        if (!this.rig) {
            if (!this.scene.textures.exists('whale_shark') || !this.scene.buildSlot()) return;
            this.rig = createRig(this.scene, { states: { normal: { key: 'whale_shark', width: SHARK.length, wiggle: 8 } }, anim: 'swim', soft: 0.5, upright: true }, s.x0, 0, L.depth);
        }
        const p = this.pose = sharkAt(t, this.routeY, this.pose || {});
        this.rig.draw({ x: p.x, y: p.y, vx: p.vx, vy: 0, frames: delta / (1000 / 60), effort: 0.3, facing: p.dir, turn: 0.02 });
        // A few bubbles along its back: the slipstream carries them, so the lane shows itself.
        if (t > this.nextBubble) {
            this.nextBubble = t + L.bubbleMs / 1000;
            const h = SHARK.length * SHARK.aspect, k = Math.random();
            this.scene.particles?.spawn('bubble', p.x + (k - 0.6) * SHARK.length * p.dir, p.y - h / 2 - SHARK.lane.over + (Math.random() - 0.5) * SHARK.lane.half, 1, { radius: 7, spread: 10 });
        }
        if (!this.seen && Math.hypot(fish.x - p.x, fish.y - p.y) < L.seen) { this.seen = true; this.onSeen(); }
    }
}
