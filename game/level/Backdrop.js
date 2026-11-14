import Phaser from 'phaser';
import { mixColor, waterHue, atLuma, WATER_LIGHT } from './biomes.js';
import SkyLayer from './SkyLayer.js';
import SeaFarLayer from './SeaFarLayer.js';

/**
 * Calm backdrop for the open world: a depth gradient that darkens as you dive,
 * drifting light rays near the surface, ambient bubbles, and the sky + waterline
 * above y = 0.
 */
/** Far fish schools are placed again once this far outside the picture (px). */
/** The surface crest line: behind the fish (full) and in front of it (a thin meniscus). */
const WATERLINE = { back: { width: 6, alpha: 0.85, depth: 4.9 }, front: { width: 2, alpha: 0.4, depth: 6 } };

/** The backdrop water from the surface (0) to the bottom of the screen (1): brightness shares of the top. */
const WATER_GRADIENT = [[0, 1], [0.25, 0.9], [0.6, 0.63], [1, 0.46]];
const WATER_TOP_LUMA = 160;     // brightness of the water just under the surface (higher clips blues to cyan: atLuma)
const OPEN_SEA = 0x35b3cc;      // the open-sea blue the biome hues are laid over (WATER_LIGHT.backdrop)
const grey = v => Math.round(v * 255) * 0x010101;
const SCHOOL_MARGIN = { x: 700, y: 500 };
/** Far fish come from one sheet: body widths (px) x tail-beat stretches, so a school is one Blitter. */
const FAR_FISH = { widths: [16, 22, 29, 37], beats: [0.88, 1, 1.12], cell: { w: 46, h: 24 } };
/**
 * Where far schools swim, among the far scenery (farDepths.js: an object at parallax s
 * draws at depth FarLayers.depthFor(s)): scroll = horizontal parallax, vscroll =
 * vertical, depth = draw order, size/alpha shrink and fade with distance.
 */
const SCHOOL_SLOTS = [
    { scroll: 0.3, vscroll: 0.18, depth: -18.5, size: 0.6, alpha: 0.32 },    // between far reef and back floor
    { scroll: 0.38, vscroll: 0.23, depth: -18, size: 0.7, alpha: 0.38 },
    { scroll: 0.5, vscroll: 0.42, depth: -16.5, size: 0.85, alpha: 0.46 },   // between back floor and mid reef
    { scroll: 0.56, vscroll: 0.58, depth: -16, size: 0.95, alpha: 0.52 }
];

export default class Backdrop {
    constructor(scene, maxDepth) {
        this.scene = scene;
        this.maxDepth = maxDepth;
        const W = scene.scale.width, H = scene.scale.height;

        // The water behind everything: a brightness-only gradient, tinted with the biome's hue,
        // so each biome's water shows its own colour instead of a blend over a fixed blue.
        makeGradient(scene, 'bd_grad', H, WATER_GRADIENT.map(([t, v]) => [t, grey(v)]));
        this.water = scene.add.image(0, 0, 'bd_grad').setOrigin(0).setDisplaySize(W, H).setScrollFactor(0).setDepth(-30);

        // Sky and waterline live in the world (scroll vertically, follow x).
        // Both are redrawn every frame so the waterline can wave.
        makeGradient(scene, 'bd_sky', 1400, [[0, 0x6fc3ee], [0.6, 0xbfe9f5], [1, 0xf2fbf4]]);
        this.sun = scene.add.circle(W * 0.72, -420, 110, 0xfffbe0, 0.95).setDepth(-29).setScrollFactor(0, 1);
        this.skyImg = scene.add.image(0, -1400, 'bd_sky').setOrigin(0).setDisplaySize(W, 1460)
            .setDepth(-29.5).setScrollFactor(0, 1);
        this.seaFar = new SeaFarLayer(scene);            // the open sea's far view: the next island's socket, marine snow, big shapes passing
        this.sky = new SkyLayer(scene);                  // clouds, birds, the coast and the volcano on the horizon
        this.sea = scene.add.graphics().setDepth(-28);   // water body drawn over the sky, wavy top edge
        // The crest line: bright just behind the fish, and a thin faint meniscus in front of it,
        // so a fish half out of the water reads as crossing the surface without a white slice
        // through its face (WATERLINE).
        this.foamBack = scene.add.graphics().setDepth(WATERLINE.back.depth);
        this.foam = scene.add.graphics().setDepth(WATERLINE.front.depth);

        // The volcano's glow on the eastern horizon: always shows which way the journey goes.
        makeSoft(scene);
        this.eastGlow = scene.add.image(W + 120, H * 0.5, 'bd_glow').setDisplaySize(900, H * 1.9).setTint(0xff3b1f).setAlpha(0.2)
            .setScrollFactor(0).setDepth(-11).setBlendMode(Phaser.BlendModes.ADD);
        scene.tweens.add({ targets: this.eastGlow, alpha: 0.32, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        // Distant schools of small fish: silhouettes far behind the play plane that
        // drift past slower than the world (parallax) and never interact.
        this.schools = [];
        for (let k = 0; k < 4; k++) {
            // wx/wy: the school's place in its own far layer (set on the first update);
            // on screen it sits at (wx - camX * depthFactor, wy - camY * depthFactor).
            const slot = SCHOOL_SLOTS[k % SCHOOL_SLOTS.length];
            const school = {
                wx: null, wy: null, dir: k % 2 ? 1 : -1,
                speed: Phaser.Math.FloatBetween(0.5, 1.1), slot, fish: [],
                blitter: scene.add.blitter(0, 0, 'bd_fish_sheet').setScrollFactor(0).setDepth(slot.depth)
            };
            const n = Phaser.Math.Between(7, 13);
            for (let i = 0; i < n; i++) {
                // Soft, out-of-focus shapes: the farther school is smaller and fainter.
                const w = Phaser.Math.Between(16, 26) * slot.size * 1.5;
                let size = 0;
                while (size < FAR_FISH.widths.length - 1 && FAR_FISH.widths[size + 1] <= w) size++;
                const body = school.blitter.create(0, 0, `f${size}_1`);
                body.setTint(0x0d4763);
                school.fish.push({ body, size, alpha: slot.alpha, ox: Phaser.Math.Between(-150, 150), oy: Phaser.Math.Between(-70, 70), phase: Math.random() * 6.28 });
            }
            this.schools.push(school);
        }

        // Light shafts live in game/fx/WaterLight.js (one system with caustics and the grade).

        this.bubbles = [];
        for (let i = 0; i < 16; i++) {
            const b = scene.textures.exists('bubble')
                ? scene.add.image(0, 0, 'bubble')
                : scene.add.circle(0, 0, 20, 0xffffff, 0.3).setStrokeStyle(3, 0xffffff, 0.6);
            b.setScrollFactor(0).setDepth(-8);
            this.resetBubble(b, true);
            this.bubbles.push(b);
        }
    }

    resetBubble(b, anywhere) {
        const W = this.scene.scale.width, H = this.scene.scale.height;
        const size = Phaser.Math.Between(14, 54);
        b.setDisplaySize(size, size).setAlpha(Phaser.Math.FloatBetween(0.2, 0.55));
        b.x = Phaser.Math.Between(0, W);
        b.y = anywhere ? Phaser.Math.Between(0, H) : H + 60;
        b.speed = 0.4 + size / 40;
        b.phase = Math.random() * 6.28;
    }

    update(camX, camY, dx, dy, surface) {
        const W = this.scene.scale.width, H = this.scene.scale.height;
        const depth = Phaser.Math.Clamp((camY + H / 2) / this.maxDepth, 0, 1);
        // Each biome colours the water; neighbours fade into each other.
        // hue only: darkness comes from depth (spec 5.0h); backdrop = how far the biome hue replaces the open-sea blue
        const hue = mixColor(OPEN_SEA, waterHue(camX + W / 2), WATER_LIGHT.backdrop);
        this.water.setTint(atLuma(hue, WATER_TOP_LUMA));

        const t = this.scene.time.now / 1000;

        this.sky.update(camX, camY);
        this.seaFar.update(camX, camY, dx, dy, this.scene.game.loop.delta);
        // Waterline: only when it is on screen.
        this.sea.clear();
        this.foam.clear();
        this.foamBack.clear();
        if (camY < 80) {
            const pts = [];
            for (let sx = -40; sx <= W + 40; sx += 32) pts.push({ x: camX + sx, y: surface.heightAt(camX + sx, t) });
            // Sky is a screen-wide image; hide the part below the waves with sea colour.
            // The sky image reaches a little below sea level; cover it from the
            // wave line down with a bright band that fades into the depth gradient.
            const x0 = pts[0].x, x1 = pts[pts.length - 1].x;
            this.sea.fillStyle(0x9be9ef, 1).beginPath().moveTo(x0, 62);
            for (const p of pts) this.sea.lineTo(p.x, p.y);
            this.sea.lineTo(x1, 62).closePath().fillPath();
            for (let k = 0; k < 40; k++) this.sea.fillStyle(0x9be9ef, 0.9 * (1 - k / 40) ** 1.6).fillRect(x0, 62 + k * 6, x1 - x0, 6);
            for (const [g, L] of [[this.foamBack, WATERLINE.back], [this.foam, WATERLINE.front]]) {
                g.lineStyle(L.width, 0xffffff, L.alpha).beginPath().moveTo(pts[0].x, pts[0].y);
                for (const p of pts) g.lineTo(p.x, p.y);
                g.strokePath();
            }
        }

        const depthFade = Math.max(0.25, 1 - depth * 0.8);
        for (const sc of this.schools) {
            // Far away = moves less than the world, by the same factor sideways and up/down.
            // A school keeps its own depth in the water: no wrapping. When it drifts well
            // out of the picture it is quietly placed again just outside the view.
            const f0 = sc.slot.scroll, v0 = sc.slot.vscroll;
            let sx = sc.wx === null ? NaN : sc.wx - camX * f0;
            let sy = sc.wy === null ? NaN : sc.wy - camY * v0;
            const out = !(sx > -SCHOOL_MARGIN.x && sx < W + SCHOOL_MARGIN.x && sy > -SCHOOL_MARGIN.y && sy < H + SCHOOL_MARGIN.y);
            if (out) {
                const first = sc.wx === null;
                const side = first ? Phaser.Math.Between(0, W) : (dx >= 0 ? W + 250 : -250);   // ahead of where the camera goes
                sx = side; sy = Phaser.Math.Between(120, H - 160);
                sc.wx = sx + camX * f0; sc.wy = sy + camY * v0;
            }
            sc.wx += sc.dir * sc.speed;
            sx = sc.wx - camX * f0;
            sy = sc.wy - camY * v0;
            const surfaceY = -camY * v0 + 60;   // the waterline as seen in this far layer
            const { w: cw, h: ch } = FAR_FISH.cell;
            for (const f of sc.fish) {
                const beat = Math.sin(t * 9 + f.phase);   // tail beat
                f.body.setFrame(`f${f.size}_${beat < -0.33 ? 0 : beat > 0.33 ? 2 : 1}`);
                f.body.x = sx + f.ox + Math.sin(t * 0.7 + f.phase) * 18 - cw / 2;
                f.body.y = sy + f.oy + Math.sin(t * 1.1 + f.phase) * 10 - ch / 2;
                f.body.flipX = sc.dir < 0;
                f.body.visible = f.body.y + ch / 2 > surfaceY;
                f.body.alpha = f.alpha * depthFade;
            }
        }
        for (const b of this.bubbles) {
            b.y -= b.speed + dy * 0.5;
            b.x += Math.sin(t * 1.4 + b.phase) * 0.5 - dx * 0.5;
            b.setVisible(camY + b.y > 40); // no bubbles in the sky
            if (b.y < -60 || b.y > H + 80 || b.x < -80 || b.x > W + 80) this.resetBubble(b, b.y > H + 80 || b.x < -80 || b.x > W + 80);
        }
    }
}

/** Soft-edged textures for everything far away: nothing in the backdrop has a hard outline. */
function makeSoft(scene) {
    if (scene.textures.exists('bd_ray')) return;
    // Light shaft: bright along the middle, feathered to both sides, fading in at the top and out at the bottom.
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
    // Round glow that fades smoothly to nothing.
    const glow = scene.textures.createCanvas('bd_glow', 128, 128), gc = glow.getContext();
    const g = gc.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    gc.fillStyle = g; gc.fillRect(0, 0, 128, 128);
    glow.refresh();
    // A fish far away, out of focus: a blurred body with a tail.
    const fish = scene.textures.createCanvas('bd_fish', 96, 48), fc = fish.getContext();
    fc.filter = 'blur(3px)';
    fc.fillStyle = '#ffffff';
    fc.beginPath(); fc.ellipse(54, 24, 28, 11, 0, 0, Math.PI * 2); fc.fill();
    fc.beginPath(); fc.moveTo(30, 24); fc.lineTo(10, 12); fc.lineTo(14, 24); fc.lineTo(10, 36); fc.closePath(); fc.fill();
    fish.refresh();
    // The same fish in a few sizes and tail-beat stretches, as frames of one sheet (the far schools).
    const { widths, beats, cell } = FAR_FISH;
    const sheet = scene.textures.createCanvas('bd_fish_sheet', cell.w * beats.length, cell.h * widths.length), sc = sheet.getContext();
    widths.forEach((w, r) => beats.forEach((b, c) => {
        const dw = w * b, dh = w * 0.5;
        sc.drawImage(fish.getSourceImage(), c * cell.w + (cell.w - dw) / 2, r * cell.h + (cell.h - dh) / 2, dw, dh);
        sheet.add(`f${r}_${c}`, 0, c * cell.w, r * cell.h, cell.w, cell.h);
    }));
    sheet.refresh();
}

function makeGradient(scene, key, h, stops) {
    if (scene.textures.exists(key)) return;
    const tex = scene.textures.createCanvas(key, 4, h);
    const ctx = tex.getContext();
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    for (const [t, c] of stops) grad.addColorStop(t, '#' + c.toString(16).padStart(6, '0'));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 4, h);
    tex.refresh();
}
