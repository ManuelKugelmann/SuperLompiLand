import { keepOut } from './ai/keepOut.js';
import { chainAt } from './followTrail.js';
import { createRig } from './CardRig.js';
import { ESCORT, schoolPlace, escortStep, belowHud } from './escort.js';
import { GRAND_NEST, friendAt } from './level/grandNest.js';

export const SCHOOL_LOOK = { depth: 4.6, clear: 40 };      // just behind the fish; clear = px each keeps from rock

/**
 * The freed friends as a little school behind the fish (escort.js): each on its own rig, the
 * newest nearest. At the grand nest they gather round the fish (grandNest.js).
 *   create():  this.school = new FriendSchool(scene); this.school.add(character) for every friend freed before
 *   rescue:    this.school.add(character, x, y)      // joins from where its dance ended
 *   update():  this.school.update(fish, heading, t, dt)      // fish = { x, y }, heading +1 east, t and dt in s
 *   arrival:   this.school.gather(nest)
 */
export default class FriendSchool {
    constructor(scene) {
        this.scene = scene;
        this.friends = [];      // nearest first: { character, rig (made when there is a free build slot), x, y }
        this.nest = null; this.gathered = 0;
        this.place = {};
    }

    /** A friend joins, nearest to the fish; without a place it comes in from behind, outside the view. */
    add(character, x = null, y = null) {
        if (this.friends.some(f => f.character.id === character.id)) return;
        this.friends.unshift({ character, rig: null, x, y });
        if (this.friends.length > ESCORT.max) this.friends.pop().rig?.destroy();
    }

    /** The fish has arrived at the grand nest: the school closes in round it. */
    gather(nest) { this.nest = nest; }

    update(fish, heading, t, dt) {
        const dir = heading >= 0 ? 1 : -1, n = this.friends.length;
        if (this.nest) this.gathered = Math.min(1, this.gathered + dt / GRAND_NEST.gatherS);
        this.friends.forEach((f, k) => {
            if (f.x === null) { f.x = fish.x - dir * ESCORT.far * 2; f.y = fish.y; }      // far behind: the step below sets it just outside the view
            // In the chain along Lompi's path (user: "chain of friends"), the newest nearest; at the grand nest they gather round him.
            const trail = this.scene.followTrail;
            const to = this.nest ? friendAt(k, n, t, this.nest, fish, this.gathered, this.place)
                : trail ? chainAt(trail, k, this.pt || (this.pt = { x: 0, y: 0 })) : schoolPlace(k, fish.x, fish.y, dir, t, this.place);
            const ox = f.x, oy = f.y;
            escortStep(f, k, to.x, belowHud(to.y, this.scene.cameras.main.worldView.y), fish.x, dir, dt);      // its place never over the HUD's band
            // Never in rock (it follows the fish's path, which may cut a corner): pushed out along the terrain's slope.
            if (this.scene.level?.rock) { const q = keepOut(f.x, f.y, SCHOOL_LOOK.clear, this.scene.level.rock, this.out || (this.out = { x: 0, y: 0 })); f.x = q.x; f.y = q.y; }
            if (!f.rig) {
                if (!this.scene.buildSlot()) return;
                f.rig = createRig(this.scene, f.character, f.x, f.y, SCHOOL_LOOK.depth);
            }
            const frames = Math.max(dt * 60, 0.01);
            f.rig.lookAt({ x: fish.x, y: fish.y });      // friends keep an eye on Lompi (rig/RigEyes.js)
            f.rig.draw({ x: f.x, y: f.y, vx: (f.x - ox) / frames, vy: (f.y - oy) / frames, frames, effort: 0.6, turn: 0.1 });
        });
    }

    destroy() {
        for (const f of this.friends) f.rig?.destroy();
        this.friends = [];
    }
}
