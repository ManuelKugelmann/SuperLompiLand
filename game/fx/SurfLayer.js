import { SURF, surgeShare, surgeCrestX, breakerX, breakerState } from '../level/surf.js';
import { play } from '../audio.js';

/** Painted foam (loaded by the title screen); drawn procedurally while missing. */
export const SURF_ART = {
    line: { key: 'foam_line', file: 'img/fx/foam_line.webp' },
    puffs: { key: 'foam_puffs', file: 'img/fx/foam_puffs.webp', frame: 256 }
};

export const SURF_LOOK = {
    lines: 5,            // foam lines of the surge that can be in view at once
    lineSize: [560, 70], // px
    puffs: 12,           // whitewater puffs in a breaker's foam cloud
    puffSize: 300,       // px
    crestSize: [900, 150],
    lift: 3.2,           // how hard a breaker lifts the water surface at its front (per frame, surface.splash units)
    sink: 0.9,           // how much the sea sinks over the crest while it draws back
    hearWithin: 2600     // px: a breaker is heard this far
};

function ensureFallbacks(scene) {
    if (!scene.textures.exists(SURF_ART.line.key)) {
        const tex = scene.textures.createCanvas(SURF_ART.line.key, 512, 64), c = tex.getContext();
        const g = c.createLinearGradient(0, 0, 0, 64);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.45, 'rgba(255,255,255,0.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        for (let i = 0; i < 16; i++) { c.beginPath(); c.ellipse(16 + i * 32, 32 + (i % 3) * 4, 30, 18 + (i % 2) * 8, 0, 0, 7); c.fill(); }
        tex.refresh();
    }
    if (!scene.textures.exists(SURF_ART.puffs.key)) {
        const tex = scene.textures.createCanvas(SURF_ART.puffs.key, 128, 128), c = tex.getContext();
        const g = c.createRadialGradient(64, 64, 4, 64, 64, 64);
        g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.6, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(0, 0, 128, 128);
        tex.refresh();
    }
}

const STATE = {};

/**
 * What the coast forces look like (level/surf.js is the rule): foam lines that run toward
 * the beach with every push of the surge, and at the reef's edge the breakers: a wave face
 * that lifts the water, a crest of foam and a cloud of whitewater tumbling toward the lagoon.
 */
export default class SurfLayer {
    constructor(scene, surface) {
        this.scene = scene; this.surface = surface;
        ensureFallbacks(scene);
        const frames = scene.textures.get(SURF_ART.puffs.key).frameTotal - 1;      // without the base frame
        this.lines = Array.from({ length: SURF_LOOK.lines }, () => scene.add.image(0, 0, SURF_ART.line.key).setDepth(6.05).setVisible(false));
        this.crest = scene.add.image(0, 0, SURF_ART.line.key).setDepth(6.1).setVisible(false);
        this.puffs = Array.from({ length: SURF_LOOK.puffs }, (_, i) => {
            const p = scene.add.image(0, 0, SURF_ART.puffs.key, frames > 1 ? i % frames : undefined).setDepth(6.08).setVisible(false);
            p.seed = i * 2.399;
            return p;
        });
        this.bx = breakerX();
        this.wave = -1;
    }

    /** Per frame. `left`, `width` = the view in world px; `phase` = time in waves; `t` s; `fishX` for what is heard. */
    update(left, width, phase, t, fishX) {
        const right = left + width, wl = SURF.surge.wavelength;
        // --- The surge: one foam line on every crest that is in the shallows and in view.
        let used = 0;
        for (let n = Math.floor(left / wl + phase - 1); used < this.lines.length; n++) {
            const x = surgeCrestX(n, phase);
            if (x > right + 400) break;
            if (x < left - 400) continue;
            const k = surgeShare(x, 1);
            if (k < 0.05) continue;
            const [w, h] = SURF_LOOK.lineSize;
            this.lines[used++].setVisible(true).setPosition(x, this.surface.heightAt(x, t) - 6).setDisplaySize(w, h).setAlpha(0.9 * k);
        }
        for (let i = used; i < this.lines.length; i++) this.lines[i].setVisible(false);

        // --- The breakers at the reef's edge.
        const near = this.bx > left - 1400 && this.bx < right + 1400;
        const st = breakerState(phase, STATE), b = SURF.breaker;
        if (st.wave !== this.wave) {
            this.wave = st.wave;
            if (st.wave >= 0 && Math.abs(fishX - this.bx) < SURF_LOOK.hearWithin) play('splash', 1.6);
        }
        const show = near && st.breaking > 0.02;
        this.crest.setVisible(show);
        for (const p of this.puffs) p.setVisible(show);
        if (!near) return;
        if (st.drawback > 0) this.surface.splash(this.bx, SURF_LOOK.sink * st.drawback, 6);       // the sea sinks over the crest
        if (!show) return;
        // The break runs from the sea side over the crest toward the lagoon within one wave.
        const u = phase - Math.floor(phase), front = this.bx + b.lead - u * (b.lead + b.reach * 0.8);
        this.surface.splash(front, -SURF_LOOK.lift * st.breaking, 4);                              // the wave face rises
        const [cw, ch] = SURF_LOOK.crestSize;
        this.crest.setPosition(front, this.surface.heightAt(front, t) - 20).setDisplaySize(cw, ch * (0.5 + st.breaking)).setAlpha(st.breaking);
        for (const p of this.puffs) {
            // Whitewater tumbles behind the front (on its sea side) and down into the cloud.
            const a = t * 3 + p.seed, back = (Math.sin(p.seed * 7.3) * 0.5 + 0.5) * 420;
            const size = SURF_LOOK.puffSize * (0.6 + 0.4 * Math.sin(a * 0.7) ** 2);
            p.setPosition(front + back + Math.cos(a) * 40, 20 + (Math.sin(p.seed * 3.1) * 0.5 + 0.5) * b.depth * 0.75 + Math.sin(a) * 30)
                .setDisplaySize(size, size).setRotation(a * 0.6).setAlpha(0.75 * st.breaking);
        }
    }
}
