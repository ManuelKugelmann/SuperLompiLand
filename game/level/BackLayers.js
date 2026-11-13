import Phaser from 'phaser';
import { BIOMES, biomeBlendAt, floorY } from './biomes.js';
import { BACK_LAYERS, BACK_KINDS, kindFor } from './backLayersTable.js';
import { ridge, rng, layerGroundY, tileOffsetX, mix, layerTint } from './backLayersMath.js';
import { sunlightAt } from '../fx/causticsMath.js';

/**
 * The background group of the parallax layers (spec 10.10 / 10.10b): far haze, far reef
 * and back floor, each with its own ground and big soft silhouettes in the biome's shapes
 * (coral domes and fans on the reef, kelp columns in the kelp forest, hulls at the wreck,
 * pilings in the harbour, spires in the trench), fogged toward the water colour.
 *
 * Baked: one white, top-lit, pre-blurred tileable texture per (shape kind, layer), tinted
 * per biome and depth; neighbouring biomes cross-fade. Nothing is redrawn per frame. Only
 * the kinds near the camera keep a texture (phones). Layers are driven by BACK_LAYERS.
 *
 *   create():  this.backLayers = new BackLayers(this)
 *   update():  this.backLayers.update(camX, camY)
 */
const TW = 1024, TH = 256;          // baked texture size
const PAD = 3;                      // transparent rows top and bottom (no wrap seam)
const MIN_GROUND = 0.12;            // thinnest ground band in a baked strip (share of its height)
const GROUND_GREY = 154;            // bottom shade of the baked ground = top of the fade (#9a9a9a)
const PREFETCH = 2600;              // bake the next biome's kind this far ahead (px)
const SEA = 0x2a9fc8, SUNLIT = 0x6ad9f2, DEEP = 0x04122e;
const FADE_DEPTH = 0.32;            // how far (share of screen height) a layer's ground shows below its ridge

export default class BackLayers {
    constructor(scene) {
        this.scene = scene;
        this.baked = new Set();
        makeFade(scene);
        const W = scene.scale.width;
        this.layers = BACK_LAYERS.filter(l => l.strength > 0).map(def => {
            // Two strips per layer (biome a and b while cross-fading) plus the solid ground below.
            const strip = () => scene.add.tileSprite(0, 0, W, 10, '__WHITE').setOrigin(0, 1).setScrollFactor(0).setDepth(def.depth).setVisible(false);
            return {
                def,
                a: strip(), b: strip(),
                base: scene.add.image(0, 0, 'bl_fade').setOrigin(0).setScrollFactor(0).setDepth(def.depth).setVisible(false)
            };
        });
    }

    textureFor(kind, def) {
        const key = `bl_${kind}_${def.id}`;
        if (!this.baked.has(key)) { bake(this.scene, key, kind, def); this.baked.add(key); }
        return key;
    }

    /** Keep only the textures of the kinds near the camera. */
    evict(keep) {
        for (const key of [...this.baked]) {
            const kind = key.split('_')[1];
            if (keep.has(kind)) continue;
            if (this.layers.some(l => l.a.blKey === key || l.b.blKey === key)) continue;
            this.scene.textures.remove(key);
            this.baked.delete(key);
        }
    }

    update(camX, camY) {
        const scene = this.scene, W = scene.scale.width, H = scene.scale.height;
        const cx = camX + W / 2;
        const bl = biomeBlendAt(cx);
        const floor = floorY(cx);
        const light = sunlightAt(camY + H * 0.5);
        const deepAmount = Phaser.Math.Clamp((camY + H / 2 - 2200) / 3400, 0, 1) * 0.7;

        // Bake ahead so crossing into a biome never waits for a texture.
        const near = new Set([kindFor(bl.a.id), kindFor(bl.b.id), kindFor(biomeBlendAt(cx + PREFETCH).b.id), kindFor(biomeBlendAt(cx - PREFETCH).a.id)]);
        for (const l of this.layers) for (const k of near) this.textureFor(k, l.def);
        if (!this.lastNear || [...near].join() !== this.lastNear) { this.lastNear = [...near].join(); this.evict(near); }

        for (const l of this.layers) {
            const d = l.def;
            const h = Math.round(H * d.height);
            const ground = layerGroundY({ camY, H, floor, scroll: d.scroll, rise: d.rise });
            const scale = h / TH;
            const fogTo = biome => mix(mix(SEA, biome.water[0], Math.min(1, biome.water[1] * 2)), SUNLIT, light * 0.5);
            const tintOf = biome => layerTint(biome.rock[2], fogTo(biome), d.fog, DEEP, deepAmount);
            const show = (strip, biome, alpha) => {
                strip.setVisible(alpha > 0.01);
                if (alpha <= 0.01) return;
                const key = this.textureFor(kindFor(biome.id), d);
                // A TileSprite's texture.key is an internal id, so remember ours.
                if (strip.blKey !== key) { strip.setTexture(key); strip.blKey = key; }
                strip.setSize(W, h).setTileScale(scale, scale).setPosition(0, ground + 2).setTint(tintOf(biome)).setAlpha(alpha * d.strength);
                strip.tilePositionX = tileOffsetX(camX, d.scroll, scale);
            };
            const same = kindFor(bl.a.id) === kindFor(bl.b.id);
            show(l.a, bl.a, same ? 1 : 1 - bl.t);
            show(l.b, bl.b, same ? 0 : bl.t);
            // Ground below the silhouettes, fading into the water: the layer reads as floor,
            // with no flat slab and no hard bottom edge (spec 10.11b).
            const gTint = mix(tintOf(bl.a), tintOf(bl.b), same ? 0 : bl.t);
            l.base.setVisible(ground < H).setPosition(0, ground - PAD * scale - 1).setDisplaySize(W, H * FADE_DEPTH).setTint(gTint).setAlpha(d.strength);
        }
    }

    destroy() {
        for (const l of this.layers) { l.a.destroy(); l.b.destroy(); l.base.destroy(); }
        for (const key of this.baked) this.scene.textures.remove(key);
        this.baked.clear();
    }
}

// --- baking --------------------------------------------------------------------

/** A vertical fade (opaque at the top, gone at the bottom), shared by every layer's ground. */
function makeFade(scene) {
    if (scene.textures.exists('bl_fade')) return;
    const c = document.createElement('canvas');
    c.width = 4; c.height = 256;
    const ctx = c.getContext('2d'), g = ctx.createLinearGradient(0, 0, 0, 256);
    const v = GROUND_GREY;
    g.addColorStop(0, `rgba(${v},${v},${v},1)`);
    g.addColorStop(0.35, `rgba(${v},${v},${v},0.75)`);
    g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 4, 256);
    scene.textures.addCanvas('bl_fade', c);
}

function bake(scene, key, kind, def) {
    const spec = BACK_KINDS[kind];
    const seed = [...(kind + def.id)].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
    const r = rng(seed);
    const canvas = document.createElement('canvas');
    canvas.width = TW; canvas.height = TH;
    const ctx = canvas.getContext('2d');
    // Top-lit white: tint multiplies it, so tops come out in the biome colour, bottoms darker.
    const shade = (y0, y1) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#9a9a9a'); return g; };

    // Ground line.
    const line = ridge(TW, seed, { ...spec.ridge, octaves: 4 });
    // At least MIN_GROUND of solid ground everywhere, so the silhouette always overlaps its
    // fade below (a ridge dipping to zero would leave a straight edge where the fade starts).
    const groundAt = x => TH - (MIN_GROUND + line[((Math.round(x) % TW) + TW) % TW] * 0.45) * TH;
    ctx.fillStyle = shade(TH * 0.45, TH);
    ctx.beginPath(); ctx.moveTo(0, TH);
    for (let x = 0; x <= TW; x += 4) ctx.lineTo(x, groundAt(x));
    ctx.lineTo(TW, TH); ctx.closePath(); ctx.fill();

    // Shapes standing on the ground; drawn twice near the edges so the tile wraps.
    const draw = (x, fn) => { for (const dx of [-TW, 0, TW]) { ctx.save(); ctx.translate(x + dx, groundAt(x) + 3); fn(); ctx.restore(); } };
    const shapes = Object.entries(spec.shapes);
    for (const [type, count] of shapes) {
        const n = Math.max(1, Math.round(count * def.density));
        for (let i = 0; i < n; i++) {
            const x = r() * TW, s = 0.6 + r() * 0.8;
            draw(x, () => SHAPES[type](ctx, s, r, shade));
        }
    }

    blurAlpha(ctx, def.blur);
    // Clear the first and last rows: the GPU's repeat wrap would otherwise blend the opaque
    // ground row into the top edge and draw a thin line there.
    ctx.clearRect(0, 0, TW, PAD); ctx.clearRect(0, TH - PAD, TW, PAD);
    scene.textures.addCanvas(key, canvas);
}

const SHAPES = {
    dome(ctx, s, r, shade) {
        const w = 70 * s + r() * 60, h = w * (0.45 + r() * 0.3);
        ctx.fillStyle = shade(-h, 0);
        ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, Math.PI, 0); ctx.fill();
    },
    fan(ctx, s, r, shade) {
        const R = 55 * s + r() * 30;
        ctx.fillStyle = shade(-R * 1.6, 0);
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.arc(0, -R * 0.55, R, Math.PI * 1.08, Math.PI * 1.92); ctx.closePath(); ctx.fill();
        ctx.fillRect(-3, -R * 0.6, 6, R * 0.6);
    },
    branch(ctx, s, r, shade) {
        ctx.strokeStyle = shade(-110 * s, 0); ctx.lineCap = 'round';
        const arm = (x, y, a, len, w, depth) => {
            if (depth === 0) return;
            const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
            ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
            arm(x2, y2, a - 0.45 - r() * 0.2, len * 0.72, w * 0.7, depth - 1);
            arm(x2, y2, a + 0.45 + r() * 0.2, len * 0.72, w * 0.7, depth - 1);
        };
        arm(0, 0, -Math.PI / 2, 38 * s, 12 * s, 4);
    },
    grass(ctx, s, r, shade) {
        ctx.strokeStyle = shade(-70 * s, 0); ctx.lineCap = 'round';
        for (let k = 0; k < 4; k++) {
            const lean = (r() - 0.5) * 40 * s, h = (40 + r() * 40) * s;
            ctx.lineWidth = 4 * s; ctx.beginPath(); ctx.moveTo(k * 6 - 9, 0);
            ctx.quadraticCurveTo(k * 6 - 9 + lean * 0.3, -h * 0.6, k * 6 - 9 + lean, -h); ctx.stroke();
        }
    },
    kelp(ctx, s, r, shade) {
        const h = TH * (0.55 + r() * 0.4) * Math.min(1.2, s), sway = (r() - 0.5) * 50;
        ctx.strokeStyle = shade(-h, 0); ctx.fillStyle = shade(-h, 0); ctx.lineCap = 'round';
        ctx.lineWidth = 6 * s; ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.bezierCurveTo(sway * 0.3, -h * 0.35, -sway * 0.4, -h * 0.7, sway, -h); ctx.stroke();
        for (let t = 0.15; t < 1; t += 0.14) {          // leaf blades along the stalk
            const y = -h * t, x = sway * t * t, side = (Math.round(t * 20) % 2 ? 1 : -1);
            ctx.beginPath(); ctx.ellipse(x + side * 12 * s, y, 16 * s, 6 * s, side * 0.6, 0, Math.PI * 2); ctx.fill();
        }
    },
    hull(ctx, s, r, shade) {
        const w = 230 * s, h = 70 * s, tilt = (r() - 0.5) * 0.35;
        ctx.rotate(tilt); ctx.fillStyle = shade(-h * 1.4, 0);
        ctx.beginPath(); ctx.moveTo(-w / 2, -h); ctx.lineTo(w / 2, -h * 1.15); ctx.lineTo(w * 0.42, 0);
        ctx.quadraticCurveTo(0, h * 0.35, -w * 0.45, 0); ctx.closePath(); ctx.fill();
        ctx.fillRect(-w * 0.1, -h * 1.5, w * 0.25, h * 0.45);          // cabin block
    },
    mast(ctx, s, r, shade) {
        const h = 150 * s, lean = (r() - 0.5) * 0.6;
        ctx.rotate(lean); ctx.fillStyle = shade(-h, 0);
        ctx.fillRect(-4 * s, -h, 8 * s, h); ctx.fillRect(-40 * s, -h * 0.75, 80 * s, 6 * s);
    },
    piling(ctx, s, r, shade) {
        const h = 120 * s + r() * 60;
        ctx.fillStyle = shade(-h, 0);
        ctx.fillRect(-9 * s, -h, 18 * s, h); ctx.fillRect(-13 * s, -h - 6, 26 * s, 8);
    },
    quay(ctx, s, r, shade) {
        const w = 420 * s, h = 90 * s;
        ctx.fillStyle = shade(-h, 0); ctx.fillRect(-w / 2, -h, w, h);
    },
    spire(ctx, s, r, shade) {
        const h = TH * (0.4 + r() * 0.45), w = 26 * s + r() * 20;
        ctx.fillStyle = shade(-h, 0);
        ctx.beginPath(); ctx.moveTo(-w, 0);
        ctx.quadraticCurveTo(-w * 0.35, -h * 0.5, (r() - 0.5) * 10, -h);
        ctx.quadraticCurveTo(w * 0.35, -h * 0.5, w, 0); ctx.closePath(); ctx.fill();
    }
};

/**
 * Soft edges: two passes of a horizontal + vertical box blur (wrapping in x). Colour is
 * blurred premultiplied by alpha, so soft edges keep the shape's colour instead of
 * fading through black (transparent canvas pixels are black).
 */
function blurAlpha(ctx, radius) {
    if (radius < 1) return;
    const img = ctx.getImageData(0, 0, TW, TH), d = img.data, N = TW * TH;
    const ch = [0, 1, 2, 3].map(() => new Float32Array(N));
    for (let i = 0; i < N; i++) {
        const al = d[i * 4 + 3] / 255;
        ch[0][i] = d[i * 4] * al; ch[1][i] = d[i * 4 + 1] * al; ch[2][i] = d[i * 4 + 2] * al; ch[3][i] = d[i * 4 + 3];
    }
    const tmp = new Float32Array(N), R = Math.round(radius), span = 2 * R + 1;
    for (const a of ch) {
        for (let pass = 0; pass < 2; pass++) {
            for (let y = 0; y < TH; y++) {            // horizontal, wrapping
                let sum = 0;
                for (let k = -R; k <= R; k++) sum += a[y * TW + ((k + TW) % TW)];
                for (let x = 0; x < TW; x++) {
                    tmp[y * TW + x] = sum / span;
                    sum += a[y * TW + ((x + R + 1) % TW)] - a[y * TW + ((x - R + TW) % TW)];
                }
            }
            for (let x = 0; x < TW; x++) {            // vertical, clamped
                let sum = 0;
                for (let k = -R; k <= R; k++) sum += tmp[Math.min(TH - 1, Math.max(0, k)) * TW + x];
                for (let y = 0; y < TH; y++) {
                    a[y * TW + x] = sum / span;
                    sum += tmp[Math.min(TH - 1, y + R + 1) * TW + x] - tmp[Math.max(0, y - R) * TW + x];
                }
            }
        }
    }
    for (let i = 0; i < N; i++) {
        const al = ch[3][i] / 255;
        d[i * 4] = al > 0.002 ? ch[0][i] / al : 255;
        d[i * 4 + 1] = al > 0.002 ? ch[1][i] / al : 255;
        d[i * 4 + 2] = al > 0.002 ? ch[2][i] / al : 255;
        d[i * 4 + 3] = ch[3][i];
    }
    ctx.putImageData(img, 0, 0);
}
