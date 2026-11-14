import Rig from './Rig.js';
import { musicClock, nowSeconds } from './audio.js';
import { createSwimmer, stepSwimmer } from './ai/swimmer.js';
import { createCrawler, stepCrawler } from './ai/crawler.js';
import { createGrumpy, stepGrumpy, calmGrumpy } from './ai/grumpy.js';
import { rigProfile, poseOf } from './ai/pose.js';

export const CREATURE = {
    grow: 0.18,        // share of the way to its new size per frame (curling in, puffing up)
    turn: 0.08,        // radians per step the nose may turn
    calmRadius: 320,   // px: a special this close calms a grumpy before it shoves
    beatSharpness: 3.5 // how hard a pulsing body snaps on the music's beat
};

const POSE_OUT = {};

/**
 * An animal of the world: the same bendable, soft-edged body as a playable (Rig), driven by a
 * mind instead of a player. Which mind comes from its row in the species table:
 *   ai      roams, rests, greets, flees (ai/swimmer.js)
 *   crawl   follows the outline of the rock (ai/crawler.js)
 *   grumpy  guards a patch, warns, shoves (ai/grumpy.js)
 * A row with none of them sits where it was put and just lives.
 */
export default class Creature {
    /** `env` = { density, threshold } of the world; `angle` = slope of the ground it is put on. */
    constructor(scene, key, row, x, y, env, seed = 0, angle = 0) {
        this.key = key;
        this.active = true;
        this.x = x; this.y = y;
        this.body = { x, y, dir: 1, lean: angle, lift: 0, bob: row.bob || 0 };
        this.size = 1;
        this.pulses = row.anim === 'pulse';
        this.rig = new Rig(scene, rigProfile(key, row), x, y, row.ground ? 1 : 4);
        if (row.crawl) {
            const c = createCrawler(x, y, env.density, env.threshold, row.crawl, seed);
            if (c.onRock) { this.crawler = c; this.body.lift = Math.hypot(x - c.x, y - c.y); }
        }
        if (row.ai) this.brain = createSwimmer({ x, y }, row.ai, seed);
        if (row.grumpy) this.grumpy = createGrumpy(x, y, row.grumpy, seed);
        this.step(0, 0, null, null);
    }

    /** Whichever mind it has (debug labels read its `state`). */
    get mind() { return this.brain || this.crawler || this.grumpy || null; }

    get height() { return this.rig.view.displayHeight; }

    /** A copy of the body on top of it that bends with it (the friends' rainbow sheen). */
    addOverlay(scene, depth) { return this.rig.addOverlay(scene, depth); }

    /**
     * Think and draw one frame. `t` s, `dt` s since the last frame; `water` = the swimmers' and
     * grumpies' world ({ isOpen, players, alarm, ... }), `ground` = the crawlers'.
     * Returns 'hit' when a grumpy's shove touches the local fish, else null.
     */
    step(t, dt, water, ground) {
        let event = null;
        if (dt > 0) {
            if (this.crawler) stepCrawler(this.crawler, dt, ground);
            const g = this.grumpy;
            if (g) {
                const al = water.alarm;
                if (al && Math.hypot(al.x - g.x, al.y - g.y) < CREATURE.calmRadius) calmGrumpy(g);
                if (stepGrumpy(g, dt, water) === 'hit') event = 'hit';
            }
            if (this.brain) stepSwimmer(this.brain, dt, water);
        }
        const p = poseOf(this, this.body, t, POSE_OUT), body = this.body;
        body.dir = p.dir; body.lean = p.lean;
        this.x = p.x; this.y = p.y;
        this.size += (p.size - this.size) * CREATURE.grow;
        this.rig.zoom = this.size;
        this.rig.draw({
            x: p.x, y: p.y, vx: p.vx, vy: p.vy, frames: dt > 0 ? dt * 60 : 1, effort: p.effort,
            facing: p.dir, turn: CREATURE.turn, lean: p.lean,
            // Every pulsing animal in view pumps together, on the music's beat.
            beat: this.pulses ? 1 - musicClock.pulse(nowSeconds(), CREATURE.beatSharpness) * 2 : undefined
        });
        return event;
    }

    destroy() {
        this.active = false;
        this.rig.destroy();
    }
}
