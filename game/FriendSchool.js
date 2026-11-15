import { keepOut } from './ai/keepOut.js';
import { FLOCK, flockStep, keepApart } from './friendFlock.js';
import { musicClock, nowSeconds } from './audio.js';
import { createRig } from './CardRig.js';
import { ESCORT, schoolPlace, escortStep, belowHud } from './escort.js';
import { GRAND_NEST, friendAt } from './level/grandNest.js';

export const SCHOOL_LOOK = { depth: 4.6, clear: 40, underSurface: 60, arrive: 200 };      // just behind the fish; clear = px each keeps from rock; underSurface = px the flock's point stays under the waves; arrive = px between friends coming in

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
        // The flock (user: "Chain => boids"): one point on Lompi's path behind him that all friends gather round,
        // and how fast it moves (they swim its way). Under the waves while he is; never over the HUD's band.
        const trail = !this.nest && this.scene.followTrail;
        let flock = null;
        if (trail) {
            const p = trail.at(FLOCK.behind, this.anchor || (this.anchor = { x: 0, y: 0 }));
            const sea = this.scene.surface?.heightAt?.(p.x, t);
            if (sea !== undefined && fish.y > sea && p.y < sea + SCHOOL_LOOK.underSurface) p.y = sea + SCHOOL_LOOK.underSurface;
            const y = belowHud(p.y, this.scene.cameras.main.worldView.y);
            const v = this.last && dt > 0 ? { vx: (p.x - this.last.x) / dt, vy: (y - this.last.y) / dt } : { vx: 0, vy: 0 };
            this.last = { x: p.x, y };
            const bar = musicClock.phase(nowSeconds()).beat / musicClock.beatsPerBar;
            flock = { x: p.x, y, v, bar, lompi: { x: fish.x, y: fish.y, vx: fish.body?.velocity?.x || 0, vy: fish.body?.velocity?.y || 0 } };
        }
        this.friends.forEach((f, k) => {
            // A friend coming in starts far behind (the step below sets it just outside the view), each further back: no pile-up.
            if (f.x === null) { f.x = fish.x - dir * (ESCORT.far * 2 + k * SCHOOL_LOOK.arrive); f.y = fish.y + (k % 2 ? 1 : -1) * SCHOOL_LOOK.arrive / 2; }
            const ox = f.x, oy = f.y;
            if (flock) {
                // A boid: drawn to the flock's point, apart from the others, swimming its way, swaying with the music (one wave per bar
                // travelling through the flock, spec 5.0z); never through another friend or over Lompi.
                f.vx ??= 0; f.vy ??= 0;
                const sway = Math.sin((flock.bar - k * 0.12) * Math.PI * 2) * FLOCK.sway;
                flockStep(f, { x: flock.x, y: flock.y + sway }, this.scene.flockMates || [], flock.v, dt);
                keepApart(f, this.scene.flockMates || [], flock.lompi);
            } else {
                // At the grand nest they gather round him; without a trail, the old school beside him.
                const to = this.nest ? friendAt(k, n, t, this.nest, fish, this.gathered, this.place) : schoolPlace(k, fish.x, fish.y, dir, t, this.place);
                escortStep(f, k, to.x, belowHud(to.y, this.scene.cameras.main.worldView.y), fish.x, dir, dt);
            }
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
