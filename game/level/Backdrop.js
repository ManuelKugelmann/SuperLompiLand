import { PARALLAX, surfaceBand } from './parallax.js';
import { shareOf } from '../quality.js';
import { DEPTH } from '../depths.js';
import Phaser from 'phaser';
import { mixColor, waterHue, atLuma, WATER_LIGHT, surfAt } from './biomes.js';
import SkyLayer from './SkyLayer.js';
import SeaFarLayer from './SeaFarLayer.js';

/**
 * Calm backdrop for the open world: a depth gradient that darkens as you dive,
 * drifting light rays near the surface, ambient bubbles, and the sky + waterline
 * above y = 0.
 */
/** Far fish schools are placed again once this far outside the picture (px). */
/** The surface crest line: behind the fish (full) and in front of it (a thin meniscus). */
const WATERLINE = {
    step: 32,      // px between two points of the wave line
    sea: { key: 'waterline_sea', level: 62, fade: 240, tint: 0x9be9ef, colour: '155,233,239' },      // sea colour down to world y `level`, then fading out over `fade` px
    back: { key: 'waterline_back', width: 6, alpha: 0.85, depth: DEPTH.surfaceLine },
    front: { key: 'waterline_front', width: 2, alpha: 0.4, depth: 6 },
    // The sea look (user: crests, foam, spray, breakers). Foam caps: a lace of foam on the line, thick
    // on the crests and thinning in the troughs (`crest` px of height over the neighbours = full cap);
    // foam streaks drifting just under the surface. Both are textured strips on a grid anchored to the
    // world (their pattern repeats every `period` px), so they stay put while the camera moves.
    caps: { key: 'waterline_caps', width: 12, period: 256, depth: 4.95, alpha: 0.95, below: 3, crest: 7, rest: 0.18 },
    streaks: { key: 'waterline_streaks', width: 10, period: 512, depth: 4.85, alpha: 0.38, below: 15, drift: 16 },
    // Spray where a surf crest breaks (surfAt above `surf`): now and then a few white droplets.
    spray: { surf: 1.25, crest: 0.85, chance: 0.05, n: 3, speed: [160, 300] }
};

/** A foam strip `len` px long: one `period`-wide tile of foam (lace or streaks), repeated, so it lines up with the world grid. */
function foamStrip(scene, key, len, cfg, kind) {
    const T = scene.textures;
    if (T.exists(key)) { if (T.get(key).source[0].width >= len) return; T.remove(key); }
    const P = cfg.period, H = cfg.width, tile = document.createElement('canvas');
    tile.width = P; tile.height = H;
    const c = tile.getContext('2d');
    let seed = kind === 'lace' ? 7 : 19;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    if (kind === 'lace') {
        // Bubbly foam: many small blobs, dense along the top edge, breaking up below.
        for (let i = 0; i < P * 1.6; i++) {
            const x = rnd() * P, y = Math.pow(rnd(), 1.8) * H, r = 0.8 + rnd() * 2.2;
            c.fillStyle = `rgba(255,255,255,${(0.45 + 0.55 * rnd()) * (1 - y / H * 0.6)})`;
            for (const dx of [0, -P, P]) { c.beginPath(); c.ellipse(x + dx, y, r * 1.4, r, 0, 0, 7); c.fill(); }
        }
    } else {
        // Streaks: long thin wisps of foam lying along the surface.
        for (let i = 0; i < 14; i++) {
            const x = rnd() * P, y = 2 + rnd() * (H - 4), w = 20 + rnd() * 70, h = 0.8 + rnd() * 1.4;
            c.fillStyle = `rgba(255,255,255,${0.35 + 0.5 * rnd()})`;
            for (const dx of [0, -P, P]) { c.beginPath(); c.ellipse(x + dx, y, w, h, 0, 0, 7); c.fill(); }
        }
    }
    const t = T.createCanvas(key, Math.ceil(len / P) * P, H), ctx = t.getContext();
    for (let x = 0; x < t.width; x += P) ctx.drawImage(tile, x, 0);
    t.refresh();
}

/** The waterline's three pictures, painted once: the strip in which the sea colour fades downward, and the two white crest lines. */
function makeWaterline(scene) {
    const T = scene.textures, S = WATERLINE.sea;
    if (!T.exists(S.key)) {
        const t = T.createCanvas(S.key, 8, S.fade), c = t.getContext();
        for (let y = 0; y < S.fade; y++) {
            c.fillStyle = `rgba(${S.colour},${(1 - y / S.fade) ** 1.6})`;      // from full sea colour (it joins the flat colour above without a step)
            c.fillRect(0, y, 8, 1);
        }
        t.refresh();
    }
    for (const L of [WATERLINE.back, WATERLINE.front]) {
        if (T.exists(L.key)) continue;
        const t = T.createCanvas(L.key, 8, L.width), c = t.getContext();
        c.fillStyle = '#ffffff'; c.fillRect(0, 0, 8, L.width);
        t.refresh();
    }
}

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
 * draws at depth FarLayers.depthFor(s)): scroll = parallax (sideways and up and down alike; formerly a separate vscroll) =
 * vertical, depth = draw order, size/alpha shrink and fade with distance.
 */
const SCHOOL_SLOTS = [
    { scroll: 0.3, depth: -18.5, size: 0.6, alpha: 0.32 },    // between far reef and back floor
    { scroll: 0.38, depth: -18, size: 0.7, alpha: 0.38 },
    { scroll: 0.5, depth: -16.5, size: 0.85, alpha: 0.46 },   // between back floor and mid reef
    { scroll: 0.56, depth: -16, size: 0.95, alpha: 0.52 }
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
        // The surface far away (parallax.js): a bright band that stays at the top edge for the first screens of a dive and slides away slowly.
        makeGradient(scene, 'bd_far_surface', 250, [[0, 0xd8fbff], [0.3, 0x8fe6f5], [0.96, 0x000000], [1, 0x000000]]);      // 250 tall: not a power of two, so its edges are not wrapped onto each other
        this.farSurface = scene.add.image(0, 0, 'bd_far_surface').setOrigin(0).setDisplaySize(W, PARALLAX.surface.band).setScrollFactor(0)
            .setDepth(-29.8).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
        this.seaFar = new SeaFarLayer(scene);            // the open sea's far view: the next island's socket, marine snow, big shapes passing
        this.sky = new SkyLayer(scene);                  // clouds, birds, the coast and the volcano on the horizon
        // The waterline. `sea` = the water body over the sky: sea colour from the wave line down to a
        // level line (drawn each frame as plain triangles between the same points the crest lines
        // use, so colour and line can never part; no path is cut into triangles), and below that
        // `seaFade`, one picture that fades into the depth gradient. The crest line: bright just
        // behind the fish, and a thin faint meniscus in front of it, so a fish half out of the water
        // reads as crossing the surface without a white slice through its face: two thin bands
        // (ropes) whose points follow the waves.
        makeWaterline(scene);
        const along = Array.from({ length: Math.ceil((W + 80) / WATERLINE.step) + 1 }, () => new Phaser.Math.Vector2());
        const band = (key, depth, alpha) => scene.add.rope(0, 0, key, null, along.map(v => v.clone()), true).setDepth(depth).setAlpha(alpha).setVisible(false);
        this.sea = scene.add.graphics().setDepth(DEPTH.seaFill);
        this.seaFade = scene.add.image(0, WATERLINE.sea.level, WATERLINE.sea.key).setOrigin(0, 0).setDepth(DEPTH.seaFill).setVisible(false);
        this.foamBack = band(WATERLINE.back.key, WATERLINE.back.depth, WATERLINE.back.alpha);
        this.foam = band(WATERLINE.front.key, WATERLINE.front.depth, WATERLINE.front.alpha);
        // Foam caps and streaks (WATERLINE.caps / streaks): their own points on a world-anchored grid.
        const grid = cfg => {
            const n = Math.ceil((W + cfg.period * 2) / WATERLINE.step) + 1;
            foamStrip(scene, cfg.key, (n - 1) * WATERLINE.step, cfg, cfg === WATERLINE.caps ? 'lace' : 'streaks');
            const r = scene.add.rope(0, 0, cfg.key, null, Array.from({ length: n }, () => new Phaser.Math.Vector2()), true).setDepth(cfg.depth).setAlpha(cfg.alpha).setVisible(false);
            r.alphaRow = new Array(n).fill(1);
            return r;
        };
        this.caps = grid(WATERLINE.caps);
        this.streaks = grid(WATERLINE.streaks);

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

    /**
     * Lay a foam strip on the waves: points on the world grid (shifted by `drift` px, so it can drift),
     * each its own alpha: full on a crest (higher than its neighbours by WATERLINE.caps.crest px),
     * thin in a trough. Where a surf crest breaks, spray now and then.
     */
    foamLine(rope, cfg, camX, t, drift, surface) {
        const step = WATERLINE.step, P = cfg.period, n = rope.points.length, base = Math.floor((camX - drift) / P) * P + drift - P;
        const ys = this.foamYs || (this.foamYs = []), A = rope.alphaRow, C = WATERLINE.caps, SP = WATERLINE.spray;
        for (let i = 0; i < n; i++) ys[i] = surface.heightAt(base + i * step, t);
        for (let i = 0; i < n; i++) {
            const x = base + i * step, y = ys[i];
            let sum = 0, k = 0;
            for (let j = Math.max(0, i - 3); j <= Math.min(n - 1, i + 3); j++) { sum += ys[j]; k++; }
            const crest = Math.min(1, Math.max(0, (sum / k - y) / C.crest));       // 0 in a trough, 1 on a crest
            rope.points[i].set(x, y + cfg.below);
            const line = surface.lineAt ? surface.lineAt(x) : 1;
            if (cfg === C) {
                A[i] = (C.rest + (1 - C.rest) * crest * crest) * line;
                const surf = surfAt(x);
                if (surf > SP.surf && crest > SP.crest && Math.random() < 1 - Math.pow(1 - SP.chance, this.steps ?? 1)) {
                    const v = SP.speed[0] + Math.random() * (SP.speed[1] - SP.speed[0]);
                    this.scene.particles?.spawn('spray', x, y - 4, SP.n, { radius: 10, spread: 70, vy: -v });
                }
            } else A[i] = (0.4 + 0.6 * (1 - crest)) * line;      // streaks lie in the troughs between crests
        }
        rope.setAlphas(A).setDirty();
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
        const steps = Math.min(4, this.scene.game.loop.delta / (1000 / 60));      // 60ths of a second this frame: drifts and chances go by the clock
        this.steps = steps;
        const depth = Phaser.Math.Clamp((camY + H / 2) / this.maxDepth, 0, 1);
        // Each biome colours the water; neighbours fade into each other.
        // hue only: darkness comes from depth (spec 5.0h); backdrop = how far the biome hue replaces the open-sea blue
        const hue = mixColor(OPEN_SEA, waterHue(camX + W / 2), WATER_LIGHT.backdrop);
        this.water.setTint(atLuma(hue, WATER_TOP_LUMA));

        const t = this.scene.time.now / 1000;

        this.sky.update(camX, camY);
        this.seaFar.update(camX, camY, dx, dy, this.scene.game.loop.delta);
        const band = surfaceBand(camY);
        this.farSurface.setVisible(band.alpha > 0.01).setY(band.top).setAlpha(band.alpha);
        // Waterline: only when it is on screen.
        const shown = camY < 80, S = WATERLINE.sea;
        for (const part of [this.seaFade, this.foamBack, this.foam, this.caps, this.streaks]) part.setVisible(shown);
        this.sea.clear();
        if (shown) {
            // A wider view than the bands were made for (the window grew): more points.
            const need = Math.ceil((W + 80) / WATERLINE.step) + 1;
            if (this.foam.points.length < need) for (const band of [this.foamBack, this.foam]) band.setPoints(Array.from({ length: need }, () => new Phaser.Math.Vector2()));
            // Sky is a screen-wide image; the sea hides the part of it below the waves: sea colour from the
            // wave line down to a level line (two triangles per step), then the fading picture.
            const n = this.foam.points.length;
            this.sea.fillStyle(S.tint, 1);
            let px = 0, py = 0;
            for (let i = 0; i < n; i++) {
                const x = camX - 40 + i * WATERLINE.step, y = surface.heightAt(x, t);
                this.foamBack.points[i].set(x, y);
                this.foam.points[i].set(x, y);
                if (i) { this.sea.fillTriangle(px, py, x, y, x, S.level + 1).fillTriangle(px, py, x, S.level + 1, px, S.level + 1); }
                px = x; py = y;
            }
            // Where something stands through the surface (surface.addCrossing: a pier) the line is broken, and a ring of foam sits there instead (foamRing.js).
            const cut = this.lineCut || (this.lineCut = []);
            cut.length = n;
            for (let i = 0; i < n; i++) cut[i] = surface.lineAt ? surface.lineAt(this.foam.points[i].x) : 1;
            this.foamBack.setAlphas(cut); this.foam.setAlphas(cut);
            this.foamBack.setDirty(); this.foam.setDirty();
            this.seaFade.setPosition(camX - 40, S.level).setDisplaySize(W + 80, S.fade);
            this.foamLine(this.caps, WATERLINE.caps, camX, t, 0, surface);
            this.foamLine(this.streaks, WATERLINE.streaks, camX, t, (t * WATERLINE.streaks.drift) % WATERLINE.streaks.period, surface);
        }

        const depthFade = Math.max(0.25, 1 - depth * 0.8);
        for (const sc of this.schools) {
            // Far away = moves less than the world, by the same factor sideways and up/down.
            // A school keeps its own depth in the water: no wrapping. When it drifts well
            // out of the picture it is quietly placed again just outside the view.
            const f0 = sc.slot.scroll, v0 = f0;      // the same share up and down as sideways (parallax.js): they never slide against the far reef they swim by
            let sx = sc.wx === null ? NaN : sc.wx - camX * f0;
            let sy = sc.wy === null ? NaN : sc.wy - camY * v0;
            const out = !(sx > -SCHOOL_MARGIN.x && sx < W + SCHOOL_MARGIN.x && sy > -SCHOOL_MARGIN.y && sy < H + SCHOOL_MARGIN.y);
            if (out) {
                const first = sc.wx === null;
                const side = first ? Phaser.Math.Between(0, W) : (dx >= 0 ? W + 250 : -250);   // ahead of where the camera goes
                sx = side; sy = Phaser.Math.Between(120, H - 160);
                sc.wx = sx + camX * f0; sc.wy = sy + camY * v0;
            }
            sc.wx += sc.dir * sc.speed * steps;
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
        // As many drifting bubbles as the quality tier's particle share (basic: a few); the rest wait hidden.
        const drifting = Math.max(3, Math.round(this.bubbles.length * shareOf(this.scene, 'particles')));
        for (let i = 0; i < this.bubbles.length; i++) {
            const b = this.bubbles[i];
            if (i >= drifting) { b.setVisible(false); continue; }
            b.y -= b.speed * steps + dy * 0.5;
            b.x += Math.sin(t * 1.4 + b.phase) * 0.5 * steps - dx * 0.5;
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
