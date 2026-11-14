import Phaser from 'phaser';
import { DEEP_GLOW, glowCell, glowShare } from './deepGlow.js';

/**
 * Glowing life of the deep (deepGlow.js places it): pulsing jellies, swaying siphonophore
 * strings and twinkling plankton sparks, additive light that only shows where the sunlight is
 * gone. Cells live around the camera only. Painted art may replace the drawn textures under
 * the same keys (glow_jelly, glow_string, glow_spark).
 *
 *   create():  this.deepGlow = new DeepGlowLayer(this, (x, y) => isOpen(x, y))
 *   update():  this.deepGlow.update(view, timeSeconds)
 */
export const GLOW_LOOK = {
    depth: 41,           // above the scene's darkness (MainScene ambient, 40): a light of its own, like the fish's glow (42)
    margin: 1,           // cells kept beyond the view on each side
    pulse: 1.6,          // jelly pulses per second
    drift: 14,           // px a jelly bobs up and down
    sway: 0.18,          // rad a string sways
    twinkle: 3.1         // spark twinkles per second
};

function ensureTextures(scene) {
    const tex = scene.textures;
    if (!tex.exists('glow_jelly')) {
        const t = tex.createCanvas('glow_jelly', 128, 160), c = t.getContext();
        const halo = c.createRadialGradient(64, 56, 4, 64, 56, 62);
        halo.addColorStop(0, 'rgba(255,255,255,0.9)'); halo.addColorStop(0.35, 'rgba(255,255,255,0.35)'); halo.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = halo; c.fillRect(0, 0, 128, 128);
        c.fillStyle = 'rgba(255,255,255,0.85)';                  // the bell
        c.beginPath(); c.moveTo(34, 62); c.bezierCurveTo(34, 22, 94, 22, 94, 62); c.quadraticCurveTo(64, 70, 34, 62); c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2;   // trailing tentacles
        for (let i = 0; i < 6; i++) {
            const x = 40 + i * 9.6;
            c.beginPath(); c.moveTo(x, 64); c.bezierCurveTo(x - 6, 95, x + 8, 120, x - 2, 156); c.stroke();
        }
        t.refresh();
    }
    if (!tex.exists('glow_string')) {
        const t = tex.createCanvas('glow_string', 32, 512), c = t.getContext();
        for (let i = 0; i < 26; i++) {                           // a chain of glowing beads, fading down
            const y = 10 + i * 19.4, r = 7 - i * 0.18, a = 0.95 - i * 0.03;
            const g = c.createRadialGradient(16, y, 0, 16, y, r * 2.2);
            g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = g; c.fillRect(0, y - r * 2.2, 32, r * 4.4);
        }
        t.refresh();
    }
    if (!tex.exists('glow_spark')) {
        const t = tex.createCanvas('glow_spark', 24, 24), c = t.getContext();
        const g = c.createRadialGradient(12, 12, 0, 12, 12, 12);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(0, 0, 24, 24);
        t.refresh();
    }
}

export default class DeepGlowLayer {
    constructor(scene, isOpen, seed = 1337) {
        this.scene = scene; this.isOpen = isOpen; this.seed = seed;
        this.live = new Map();       // "cx:cy" -> [{ g, obj }]
        ensureTextures(scene);
    }

    build(cx, cy) {
        const s = this.scene, add = Phaser.BlendModes.ADD;
        return glowCell(cx, cy, this.seed, this.isOpen, DEEP_GLOW, this.night).map(g => {
            let obj;
            if (g.kind === 'jelly') obj = s.add.image(g.x, g.y, 'glow_jelly').setScale(g.size / 128);
            else if (g.kind === 'string') obj = s.add.image(g.x, g.y, 'glow_string').setOrigin(0.5, 0).setScale(g.size / 512);
            else {
                // A cloud of plankton sparks is one Blitter.
                obj = s.add.blitter(0, 0, 'glow_spark');
                const r = Math.sin(g.phase * 97.1);
                for (let i = 0; i < 14; i++) {
                    const a = i * 2.39996 + g.phase, d = Math.sqrt((i + 0.5) / 14) * g.size * 0.5;
                    obj.create(g.x + Math.cos(a) * d - 12, g.y + Math.sin(a) * d * 0.7 - 12).setTint(g.hue);
                }
                obj.seed = r;
            }
            obj.setBlendMode(add).setDepth(GLOW_LOOK.depth);
            if (obj.setTint) obj.setTint(g.hue);
            return { g, obj, y0: g.y };
        });
    }

    /** view = camera world view {x, y, width, height}; t = s; night = 0 day .. 1 full night (light.js nightShare). */
    update(view, t, night = 0) {
        const C = DEEP_GLOW.cell, m = GLOW_LOOK.margin;
        // The night comes in steps: when it changes, the cells are placed again for it.
        const step = Math.round(night * 4) / 4;
        if (step !== this.night) { this.destroy(); this.night = step; }
        const cx0 = Math.floor(view.x / C) - m, cx1 = Math.floor((view.x + view.width) / C) + m;
        const cy0 = Math.max(0, Math.floor(view.y / C) - m), cy1 = Math.floor((view.y + view.height) / C) + m;
        const keep = new Set();
        if (glowShare(view.y + view.height + m * C, DEEP_GLOW, this.night) > 0) {
            for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
                const id = `${cx}:${cy}`;
                keep.add(id);
                if (!this.live.has(id)) this.live.set(id, this.build(cx, cy));
            }
        }
        for (const [id, list] of this.live) {
            if (keep.has(id)) {
                for (const { g, obj, y0 } of list) this.animate(g, obj, y0, t);
                continue;
            }
            for (const { obj } of list) obj.destroy();
            this.live.delete(id);
        }
    }

    animate(g, obj, y0, t) {
        const L = GLOW_LOOK, light = glowShare(y0, DEEP_GLOW, this.night);
        if (g.kind === 'jelly') {
            const p = Math.sin(t * L.pulse * Math.PI * 2 / 2 + g.phase);
            obj.y = y0 + Math.sin(t * 0.4 + g.phase) * L.drift;
            obj.setScale(g.size / 128 * (1 + p * 0.06), g.size / 128 * (1 - p * 0.08)).setAlpha(light * (0.7 + 0.3 * p));
        } else if (g.kind === 'string') {
            obj.setRotation(Math.sin(t * 0.35 + g.phase) * L.sway).setAlpha(light * 0.85);
        } else {
            obj.alpha = light * (0.55 + 0.45 * Math.sin(t * L.twinkle + g.phase));
        }
    }

    destroy() {
        for (const list of this.live.values()) for (const { obj } of list) obj.destroy();
        this.live.clear();
    }
}
