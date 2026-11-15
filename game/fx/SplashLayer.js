import { splashShape, dropVelocity } from './splash.js';
import { ensureFoam, SURF_ART } from './SurfLayer.js';

/** Foam patches left on the water by splashes: how many at once, where they sit, how opaque. */
export const SPLASH_LOOK = { patches: 4, depth: 6.07, alpha: 0.85, height: 0.22 };

/**
 * Draws a splash (splash.js is the rule): kicks the surface springs, throws droplets and pulls bubbles
 * under through the shared particles, and leaves a foam patch that rides the waves while it spreads and
 * fades. Pooled: no game objects or tweens per splash.
 */
export default class SplashLayer {
    constructor(scene, surface) {
        this.scene = scene; this.surface = surface;
        ensureFoam(scene);
        const frames = scene.textures.get(SURF_ART.puffs.key).frameTotal - 1;
        // Each patch: its picture and its own state (kept apart: a game object has fields of its own, `w` among them).
        this.patches = Array.from({ length: SPLASH_LOOK.patches }, (_, i) =>
            ({ img: scene.add.image(0, 0, SURF_ART.puffs.key, frames > 1 ? i % frames : undefined).setDepth(SPLASH_LOOK.depth).setVisible(false), age: 0, life: 0, width: 0, grow: 1, x: 0 }));
        this.next = 0;
        this.v = {};
    }

    /** Something met the surface at (x, y) with `speed` px per step; `carryVx` = its sideways speed in px/s. */
    hit(x, y, speed, entering, carryVx = 0) {
        const s = splashShape(speed, entering);
        if (!s) return null;
        this.surface.splash(x, s.dent, s.width);
        const P = this.scene.particles, v = this.v;      // the scene's, read each time: it is made anew on a resize
        for (let i = 0; i < s.drops; i++) {
            dropVelocity(s, i, carryVx, Math.random, v);
            P.spawn('drop', x + (Math.random() * 2 - 1) * 30, y - 6, 1, { vx: v.vx, vy: v.vy, spread: 25 });
        }
        if (s.bubbles) P.spawn('bubble', x, y + s.deep * 0.5, s.bubbles, { radius: s.deep * 0.5, vy: 120, spread: 90 });
        const p = this.patches[this.next];
        this.next = (this.next + 1) % this.patches.length;
        p.img.setVisible(true).setFlipX(Math.random() < 0.5);
        Object.assign(p, { age: 0, life: s.foam.life, width: s.foam.w, grow: s.foam.grow, x });
        return s;
    }

    /** Per frame: the foam patches ride the waves, spread and fade. `t` = the surface's time in s. */
    update(dt, t) {
        for (const p of this.patches) {
            if (!p.img.visible) continue;
            p.age += dt;
            const u = p.age / p.life;
            if (u >= 1) { p.img.setVisible(false); continue; }
            const w = p.width * (1 + (p.grow - 1) * Math.sqrt(u));
            p.img.setPosition(p.x, this.surface.heightAt(p.x, t)).setDisplaySize(w, w * SPLASH_LOOK.height).setAlpha(SPLASH_LOOK.alpha * (1 - u) * (1 - u));
        }
    }

    destroy() { for (const p of this.patches) p.img.destroy(); }
}
