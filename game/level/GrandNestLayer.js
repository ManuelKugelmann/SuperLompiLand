import { createRig } from '../CardRig.js';
import { getCharacter } from '../characters.js';
import { GRAND_NEST, friendAt } from './grandNest.js';

/**
 * Draws the freed friends at the grand nest (grandNest.js): built only near the nest, each on
 * its own rig, circling in the warm light and gathering round the fish on arrival.
 *   create():  this.grandNest = new GrandNestLayer(scene, nest, () => friendIds)
 *   update():  this.grandNest.update(fish, t, dt)      // t and dt in s
 *   arrival:   this.grandNest.gather()
 */
export default class GrandNestLayer {
    constructor(scene, nest, friends) {
        this.scene = scene; this.nest = nest; this.friends = friends;
        this.rigs = null; this.gathering = false; this.gathered = 0; this.pos = {};
    }

    /** The fish has arrived: the friends close in round it. */
    gather() { this.gathering = true; }

    update(fish, t, dt) {
        const d = Math.abs(fish.x - this.nest.x);
        if (this.rigs && d > GRAND_NEST.far) this.clear();
        if (!this.rigs) {
            if (d > GRAND_NEST.near || !this.scene.buildSlot()) return;
            this.rigs = this.friends().map(id => createRig(this.scene, getCharacter(id), this.nest.x, this.nest.y - GRAND_NEST.above, GRAND_NEST.depth));
        }
        if (this.gathering) this.gathered = Math.min(1, this.gathered + dt / GRAND_NEST.gatherS);
        this.rigs.forEach((rig, i) => {
            const p = friendAt(i, this.rigs.length, t, this.nest, fish, this.gathered, this.pos);
            rig.draw({ x: p.x, y: p.y, vx: p.vx / 60, vy: p.vy / 60, frames: dt * 60, effort: 0.3, facing: p.vx < 0 ? -1 : 1, turn: 0.08 });
        });
    }

    clear() {
        for (const rig of this.rigs || []) rig.destroy();
        this.rigs = null;
    }

    destroy() { this.clear(); }
}
