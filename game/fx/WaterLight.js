import Phaser from 'phaser';
import { causticPattern, sunlightAt, gradeMatrix } from './causticsMath.js';

/**
 * Sunlight under water — one system for light shafts, caustics and the colour grade
 * (gamedesign 1.1 #5, 10.11). Plain textured quads plus one camera ColorMatrix, so it
 * runs the same on Phaser 3.90 and 4; nothing is redrawn per frame and nothing touches
 * the HUD scene. Everything fades with depth (sunlightAt). Each effect reads one
 * constant here: 0 switches it off.
 *
 *   create():  this.waterLight = new WaterLight(this)
 *   update():  this.waterLight.update(sun)   sun 0..1: the sky's light (night and storms dim it; game/level/light.js)
 */
export const WATER_LIGHT = {
    shafts: 1.8,          // strength of the light shafts (0 = off)
    shaftCount: 7,        // broad shafts behind the play plane
    shaftNear: 3,         // thin shafts in front of the play plane (kept faint, never hide hazards)
    caustics: 0,          // caustic shimmer (0 = off): off until it can be projected on rock and sand only;
                          // a screen-wide pattern read as a net over the water (user feedback 2026-11-14)
    causticScale: 2.6,    // world size of the caustic tile relative to its 256 px texture
    causticFade: 1500,    // caustics fade faster than the shafts: a shallow-water effect
    grade: 1,             // depth colour grade on the camera (0 = off)
    gradeSaturation: 0.2, // extra saturation in full sunlight
    gradeAbsorb: 0.32,    // how much red is lost at full depth
    gradeExposure: 0.22,  // brightness lift in full sunlight (style guide: shallow water is bright)
    fadeTo: 2600,         // depth (px below the surface) where the sunlight has faded away
    dither: 0.035         // strength of the fine noise that breaks up colour banding in smooth water (0 = off)
};

const TEX = 256;
// Back shafts fall on everything behind the play plane, the cave back walls (depth -6) included.
const SHAFT_BACK_DEPTH = -5.8;

export default class WaterLight {
    constructor(scene) {
        this.scene = scene;
        const W = scene.scale.width, H = scene.scale.height;
        makeTextures(scene);

        // Broad shafts behind the play plane, thin ones in front; all slanted the same way,
        // the way sunlight comes through a rippled surface.
        this.shafts = [];
        const shaft = (front, i, n) => {
            const x = (W + 400) * (i + Math.random() * 0.6) / n - 200;
            const img = scene.add.image(x, -40, 'bd_ray').setOrigin(0.5, 0)
                .setDisplaySize(front ? Phaser.Math.Between(70, 140) : Phaser.Math.Between(220, 460), H * Phaser.Math.FloatBetween(0.9, 1.25))
                .setRotation(-0.22 + Phaser.Math.FloatBetween(-0.05, 0.05))
                .setScrollFactor(0).setDepth(front ? 5.6 : SHAFT_BACK_DEPTH).setBlendMode(Phaser.BlendModes.ADD);
            img.base = front ? Phaser.Math.FloatBetween(0.05, 0.09) : Phaser.Math.FloatBetween(0.16, 0.3);
            img.phase = Math.random() * 6.28;
            img.baseX = x;
            img.drift = front ? 0.12 : 0.05;   // a little parallax: near shafts slide more
            this.shafts.push(img);
        };
        if (WATER_LIGHT.shafts > 0) {
            for (let i = 0; i < WATER_LIGHT.shaftCount; i++) shaft(false, i, WATER_LIGHT.shaftCount);
            for (let i = 0; i < WATER_LIGHT.shaftNear; i++) shaft(true, i, WATER_LIGHT.shaftNear);
        }

        // Caustics: two copies of one seamless tile at different sizes drifting apart,
        // anchored to the world (they slide with the scene, not with the camera).
        this.caustics = [];
        if (WATER_LIGHT.caustics > 0) {
            for (const [k, sx, sy] of [[1, 9, 5], [1.73, -6, 7]]) {
                const ts = scene.add.tileSprite(0, 0, W, H, 'wl_caustic').setOrigin(0).setScrollFactor(0)
                    .setDepth(5.4).setBlendMode(Phaser.BlendModes.ADD).setTint(0xfff3c4);
                ts.k = k * WATER_LIGHT.causticScale;
                ts.setTileScale(ts.k, ts.k);
                ts.speed = { x: sx, y: sy };
                this.caustics.push(ts);
            }
        }

        // Dither: a fine static noise over the scene, a few grey levels either way, so the
        // smooth water gradients never show 8-bit colour bands (spec 10.11b: no lines).
        this.dither = null;
        if (WATER_LIGHT.dither > 0) {
            if (!scene.textures.exists('wl_dither')) {
                const c = scene.textures.createCanvas('wl_dither', 128, 128), dctx = c.getContext(), img = dctx.createImageData(128, 128);
                for (let i = 0; i < 128 * 128; i++) { const v = Math.random() * 255; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
                dctx.putImageData(img, 0, 0); c.refresh();
            }
            this.dither = scene.add.tileSprite(0, 0, W, H, 'wl_dither').setOrigin(0).setScrollFactor(0).setDepth(39.5).setAlpha(WATER_LIGHT.dither);
        }

        // Colour grade on the main camera (WebGL post effect; skipped if unavailable).
        this.grade = null;
        const cam = scene.cameras.main;
        if (WATER_LIGHT.grade > 0 && cam.postFX?.addColorMatrix) {
            this.grade = cam.postFX.addColorMatrix();
            this.lastLight = -1;
        }
    }

    update(sun = 1) {
        const scene = this.scene, cam = scene.cameras.main;
        const W = scene.scale.width, H = scene.scale.height;
        const t = scene.time.now / 1000;
        // Light where the upper third of the view is: that is where shafts and caustics read.
        // (Never above the waterline: when the view rises into the sky, the water below it is the shallowest there is.)
        const light = sunlightAt(Math.max(0, cam.scrollY + H * 0.35), WATER_LIGHT.fadeTo) * sun;
        const above = cam.scrollY < 0 ? Math.min(1, -cam.scrollY / (H * 0.5)) : 0;   // view partly in the sky

        for (const s of this.shafts) {
            s.x = s.baseX + Math.sin(t * 0.21 + s.phase) * 60 - ((cam.scrollX * s.drift) % (W + 400));
            if (s.x < -260) s.x += W + 400; else if (s.x > W + 260) s.x -= W + 400;
            s.y = Math.max(-40, -cam.scrollY - 30);   // shafts start at the water surface
            const flicker = 0.85 + 0.15 * Math.sin(t * 0.18 + s.phase);   // slow breathing, never a flicker
            // The shafts hang from the water surface, so they stay when the view rises into the
            // sky with a jumping player: what is under water is still lit.
            s.setAlpha(WATER_LIGHT.shafts * s.base * flicker * light);
        }

        if (this.caustics.length) {
            const a = WATER_LIGHT.caustics * sunlightAt(cam.scrollY + H * 0.35, WATER_LIGHT.causticFade) * (1 - above);
            for (const c of this.caustics) {
                c.setVisible(a > 0.003).setAlpha(a);
                if (a <= 0.003) continue;
                // World-anchored: tile offset follows the camera, plus a slow drift.
                c.tilePositionX = (cam.scrollX + t * c.speed.x) / c.k;
                c.tilePositionY = (cam.scrollY + t * c.speed.y) / c.k;
            }
        }

        if (this.grade) {
            // Ease the light so camera bobbing never pumps the colours, and update in tiny
            // steps (no visible jumps between quantised levels).
            this.smooth = this.smooth === undefined ? light : this.smooth + (light - this.smooth) * 0.03;
            const q = this.smooth;
            if (Math.abs(q - this.lastLight) > 0.002) {
                this.lastLight = q;
                const m = gradeMatrix(q, WATER_LIGHT.gradeSaturation * WATER_LIGHT.grade, WATER_LIGHT.gradeAbsorb * WATER_LIGHT.grade, WATER_LIGHT.gradeExposure * WATER_LIGHT.grade);
                // Phaser's ColorMatrix keeps offsets in 0..255.
                this.grade.set(m.map((v, i) => (i % 5 === 4 ? v * 255 : v)));
            }
        }
    }

    destroy() {
        for (const o of [...this.shafts, ...this.caustics]) o.destroy();
        this.dither?.destroy();
        if (this.grade) this.scene.cameras.main.postFX?.remove(this.grade);
    }
}

function makeTextures(scene) {
    if (!scene.textures.exists('wl_caustic')) {
        const p = causticPattern(TEX, 34, 7, 0.05);
        const tex = scene.textures.createCanvas('wl_caustic', TEX, TEX), ctx = tex.getContext();
        const img = ctx.createImageData(TEX, TEX);
        for (let i = 0; i < p.length; i++) {
            img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255;
            img.data[i * 4 + 3] = Math.round(255 * p[i]);
        }
        ctx.putImageData(img, 0, 0);
        tex.refresh();
    }
    if (!scene.textures.exists('bd_ray')) {
        // Same soft shaft as the backdrop used: bright along the middle, feathered to both sides.
        const ray = scene.textures.createCanvas('bd_ray', 128, 256), rc = ray.getContext();
        const img = rc.createImageData(128, 256);
        for (let y = 0; y < 256; y++) {
            const v = y / 255, along = Math.min(1, v * 9) * Math.pow(1 - v, 1.4);
            for (let x = 0; x < 128; x++) {
                const u = Math.abs(x / 127 - 0.5) * 2, across = Math.pow(Math.max(0, 1 - u * u), 2.2);
                const i = (y * 128 + x) * 4;
                img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
                img.data[i + 3] = 255 * along * across;
            }
        }
        rc.putImageData(img, 0, 0);
        ray.refresh();
    }
}
