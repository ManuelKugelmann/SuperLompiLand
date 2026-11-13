import Phaser from 'phaser';
import { createParticles, PARTICLES } from './particles.js';

// Draws the shared particle simulation (particles.js) with pooled Blitters: every
// particle is a Bob, so there are no game objects or tweens per particle. Normal
// and additive particles are drawn directly; 'soft' presets (oil, plumes, smoke,
// ash) are drawn into a half-resolution render texture with a blur, so a dense
// patch reads as one soft cloud instead of separate dots. Sizes come from a few
// pre-drawn soft dots (Bobs cannot scale).

const TEX = 'fx_softdot';
const SIZES = [6, 9, 13, 18, 26, 36, 50, 70];

function softDotTexture(scene) {
    if (scene.textures.exists(TEX)) return;
    const pad = 2, w = SIZES.reduce((s, d) => s + d + pad, 0), h = SIZES[SIZES.length - 1];
    const tex = scene.textures.createCanvas(TEX, w, h);
    const ctx = tex.getContext();
    let x = 0;
    SIZES.forEach((d, i) => {
        const r = d / 2, cx = x + r, cy = h / 2;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.45, 'rgba(255,255,255,0.75)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        tex.add(i, 0, x, (h - d) / 2, d, d);
        x += d + pad;
    });
    tex.refresh();
}

/** Soft clouds: render-texture resolution (share of the screen) and blur strength. */
export const SOFT = { scale: 0.5, blur: 1.6, blurSteps: 4 };

const frameFor = size => {
    for (let i = 0; i < SIZES.length; i++) if (size <= SIZES[i]) return i;
    return SIZES.length - 1;
};

export default class ParticleLayer {
    /** @param env see particles.js step(): flowAt, isSolid, surfaceY (functions, swappable later) */
    constructor(scene, env = {}, { capacity = PARTICLES.capacity, depthNormal = 2.5, depthAdd = 4.5 } = {}) {
        this.scene = scene;
        this.env = env;
        this.sim = createParticles({ capacity });
        softDotTexture(scene);
        this.layers = {
            normal: this.makeBlitter(depthNormal, Phaser.BlendModes.NORMAL, capacity),
            add: this.makeBlitter(depthAdd, Phaser.BlendModes.ADD, capacity),
            // Not on the display list: drawn into the soft render texture each frame.
            soft: this.makeBlitter(depthNormal, Phaser.BlendModes.NORMAL, capacity, false)
        };
        const W = scene.scale.width, H = scene.scale.height;
        this.softRT = scene.add.renderTexture(0, 0, Math.ceil(W * SOFT.scale), Math.ceil(H * SOFT.scale))
            .setOrigin(0).setScrollFactor(0).setScale(1 / SOFT.scale).setDepth(depthNormal);
        this.softRT.camera.setOrigin(0, 0).setZoom(SOFT.scale);
        this.softRT.preFX?.addBlur(1, SOFT.blur, SOFT.blur, 1, 0xffffff, SOFT.blurSteps);
    }

    makeBlitter(depth, blend, n, shown = true) {
        const b = shown ? this.scene.add.blitter(0, 0, TEX) : new Phaser.GameObjects.Blitter(this.scene, 0, 0, TEX);
        b.setDepth(depth).setBlendMode(blend);
        b.pool = b.createMultiple(n, 0, false);
        b.used = 0;
        return b;
    }

    /** Spawn particles; see particles.js spawn() for options. */
    spawn(id, x, y, n, opts) { return this.sim.spawn(id, x, y, n, opts); }

    /** Exposure helper for hazards (spec 7.1). */
    densityAt(id, x, y, r) { return this.sim.densityAt(id, x, y, r); }

    /** Advance (dt in seconds) and update the Bobs. */
    update(dt) {
        this.sim.step(dt, this.env);
        const L = this.layers;
        L.normal.used = 0;
        L.add.used = 0;
        L.soft.used = 0;
        this.sim.forEach((x, y, size, alpha, color, blend, i, soft) => {
            const b = soft ? L.soft : blend === 'add' ? L.add : L.normal;
            const bob = b.pool[b.used++];
            const f = frameFor(size);
            bob.setFrame(f);
            const d = SIZES[f];
            bob.x = x - d / 2;
            bob.y = y - d / 2;
            bob.alpha = alpha;
            bob.tint = color;
            bob.visible = true;
        });
        for (const b of [L.normal, L.add, L.soft]) {
            for (let i = b.used; i < b.pool.length && b.pool[i].visible; i++) b.pool[i].visible = false;
        }
        // Soft clouds: redraw only while there is something to show.
        const rt = this.softRT;
        if (L.soft.used || rt.wasUsed) {
            const cam = this.scene.cameras.main;
            rt.camera.setScroll(cam.scrollX, cam.scrollY);
            rt.clear();
            if (L.soft.used) rt.draw(L.soft);
            rt.wasUsed = L.soft.used > 0;
        }
    }

    destroy() {
        this.layers.normal.destroy();
        this.layers.add.destroy();
        this.layers.soft.destroy();
        this.softRT.destroy();
    }
}
