import { createRig } from '../CardRig.js';
import { MANTA, mantaAt } from './manta.js';

/** The painted manta (loaded by the title screen); its part cards come with the others (CardRig.loadParts). */
export const MANTA_ART = { key: 'manta', file: 'img/manta.png' };

const POSE = {};

/**
 * The manta in the world (ai/manta.js is where it goes): one body rig, behind the fish, drawn
 * only while it is near the view. `onSeen()` is called once, when the fish first comes close.
 */
export default class MantaLayer {
    constructor(scene, routeY, onSeen) {
        this.scene = scene; this.routeY = routeY; this.onSeen = onSeen;
        this.rig = null;
        this.seen = false;
    }

    /** Per frame. `fish` = { x, y }, `t` s, `delta` ms. */
    update(fish, t, delta) {
        const p = mantaAt(t, this.routeY, POSE), near = Math.abs(p.x - fish.x) < this.scene.scale.width * 1.2 && Math.abs(p.y - fish.y) < this.scene.scale.height * 1.2;
        if (!this.rig) {
            if (!near || !this.scene.textures.exists(MANTA_ART.key)) return;      // made when it first comes into view (and only with its picture)
            this.rig = createRig(this.scene, { states: { normal: { key: MANTA_ART.key, width: MANTA.width, wiggle: 10 } }, anim: 'swim', soft: 0.5, upright: true }, p.x, p.y, 3.6);
        }
        this.rig.setVisible(near);
        if (!near) return;
        this.rig.draw({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, frames: delta / (1000 / 60), effort: 0.35, facing: p.dir, turn: 0.03 });
        if (!this.seen && Math.hypot(p.x - fish.x, p.y - fish.y) < MANTA.seen) { this.seen = true; this.onSeen(); }
    }
}
