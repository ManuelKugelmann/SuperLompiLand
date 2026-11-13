import Phaser from 'phaser';
import { biomeBlendAt, floorY } from './biomes.js';
import { MID_LAYERS } from './backLayersTable.js';
import { layerGroundY, groundLine, mix, rng } from './backLayersMath.js';
import { sunlightAt } from '../fx/causticsMath.js';
import { makeFade } from './BackLayers.js';

/**
 * Midground (spec 10.10 "mid reef" 0.5 and "back play" 0.8): a reef behind the play plane
 * built from the game's own painted art, so it looks like the same world further away —
 * the rock and sand textures for the ground, the coral, rock and kelp sprites standing on
 * it — never drawn primitives.
 *
 * Baked once per 1024-px chunk of layer space (seeded, so the same place always looks the
 * same), placed as plain images that slide at the layer's parallax; at most one chunk is
 * baked per frame. Decor is only placed where it fits inside its chunk (no cut-off
 * sprites), the ground line is one continuous curve across chunks, and each chunk's ground
 * fades out at the bottom (no slabs). Fogged toward the biome's water colour by tint.
 *
 *   create():  this.midLayers = new MidLayers(this)
 *   update():  this.midLayers.update(camX, camY)
 */
const CW = 1024, CHT = 512;          // chunk texture size (layer px)
const SEA = 0x2a9fc8, SUNLIT = 0x6ad9f2, DEEP = 0x04122e;

// What stands on the ground per biome: [texture key, weight, scale factor].
const DECOR = {
    beach: [['coral_2', 2, 0.8], ['coral_3', 2, 0.8], ['rock_1', 3, 0.6]],
    reef: [['coral_1', 4, 1], ['coral_2', 4, 1], ['coral_3', 3, 0.95], ['rock_1', 2, 0.8], ['kelp', 1, 1.1]],
    mangrove: [['kelp', 3, 0.8], ['coral_3', 2, 0.8], ['rock_1', 3, 0.7]],
    kelp: [['kelp', 9, 1.4], ['rock_1', 2, 0.8], ['coral_3', 1, 0.8]],
    blue: [['rock_1', 3, 0.9], ['coral_1', 1, 0.8]],
    wreck: [['rock_1', 4, 0.9], ['kelp', 2, 0.9], ['coral_2', 1, 0.8]],
    harbour: [['rock_1', 4, 0.9], ['kelp', 2, 0.8]],
    trench: [['rock_1', 3, 0.9], ['coral_3', 1, 0.7]]
};

export default class MidLayers {
    constructor(scene) {
        this.scene = scene;
        makeFade(scene);
        this.layers = MID_LAYERS.filter(l => l.strength > 0).map(def => ({ def, chunks: new Map() }));
    }

    update(camX, camY) {
        const scene = this.scene, W = scene.scale.width, H = scene.scale.height;
        const cx = camX + W / 2;
        const floor = floorY(cx);
        const light = sunlightAt(camY + H * 0.5);
        const deepAmount = Phaser.Math.Clamp((camY + H / 2 - 2200) / 3400, 0, 1) * 0.7;
        let bakedThisFrame = false;

        for (const l of this.layers) {
            const d = l.def;
            const h = H * d.height, s = h / CHT, cwS = CW * s;        // display size of a chunk
            const lx = camX * d.scroll;                                 // layer-space camera
            const i0 = Math.floor(lx / cwS) - 1, i1 = Math.floor((lx + W) / cwS) + 1;
            for (const [i, c] of l.chunks) {                            // drop chunks far off screen
                if (i < i0 - 1 || i > i1 + 1) { c.img.destroy(); c.fade.destroy(); scene.textures.remove(c.key); l.chunks.delete(i); }
            }
            const ground = layerGroundY({ camY, H, floor, scroll: d.scroll, vscroll: d.vscroll, rise: d.rise, surfaceGap: 220 });
            for (let i = i0; i <= i1; i++) {
                let c = l.chunks.get(i);
                if (!c) {
                    if (bakedThisFrame) continue;                       // spread baking over frames
                    c = this.makeChunk(l, i, s, d);
                    l.chunks.set(i, c);
                    bakedThisFrame = true;
                }
                const x = i * cwS - lx;
                const fogTo = mix(mix(SEA, c.biome.water[0], Math.min(1, c.biome.water[1] * 2)), SUNLIT, light * 0.45);
                // Fog = the water showing through (alpha) plus a gentle shift toward its colour
                // (tint alone can only darken, never wash out toward the water).
                const tint = mix(mix(0xffffff, fogTo, d.fog * 0.5), DEEP, deepAmount);
                const alpha = d.strength * (1 - d.fog * 0.6);
                const bottom = ground + h * 0.32;
                c.img.setPosition(x, bottom).setDisplaySize(cwS + 1, h).setTint(tint).setAlpha(alpha);
                c.fade.setPosition(x, bottom - 2).setDisplaySize(cwS + 1, H * 0.3).setTint(mix(mix(0x6a5e52, fogTo, d.fog * 0.5), DEEP, deepAmount)).setAlpha(alpha);
            }
        }
    }

    makeChunk(l, i, s, d) {
        const scene = this.scene;
        // Which biome this chunk shows: the world x that the chunk's centre lines up with.
        const worldX = ((i + 0.5) * CW * s) / d.scroll;
        const biome = biomeBlendAt(worldX).a;
        const key = `ml_${d.id}_${i}`;
        const canvas = document.createElement('canvas');
        canvas.width = CW; canvas.height = CHT;
        const ctx = canvas.getContext('2d');
        const seed = (i * 2654435761 + d.id.length * 97) >>> 0;
        const r = rng(seed);
        const gx0 = i * CW;
        const topAt = x => CHT * (0.66 - 0.2 * groundLine(gx0 + x, d.id.length * 31 + 5));

        // Ground: the rock texture, a sand band along the top, light from above.
        const path = () => {
            ctx.beginPath(); ctx.moveTo(0, CHT);
            for (let x = 0; x <= CW; x += 8) ctx.lineTo(x, topAt(x));
            ctx.lineTo(CW, CHT); ctx.closePath();
        };
        const rock = scene.textures.exists('tex_rock') ? scene.textures.get('tex_rock').getSourceImage() : null;
        const sand = scene.textures.exists('tex_sand') ? scene.textures.get('tex_sand').getSourceImage() : null;
        ctx.save(); path(); ctx.clip();
        if (rock) {
            const pat = ctx.createPattern(rock, 'repeat');
            pat.setTransform?.(new DOMMatrix().translateSelf(-(gx0 % 512), 0).scaleSelf(0.7, 0.7));
            ctx.fillStyle = pat;
        } else ctx.fillStyle = '#7a6a58';
        ctx.fillRect(0, 0, CW, CHT);
        if (sand) {                                                       // sand on the top edge
            const pat = ctx.createPattern(sand, 'repeat');
            pat.setTransform?.(new DOMMatrix().translateSelf(-(gx0 % 512), 0).scaleSelf(0.6, 0.6));
            ctx.strokeStyle = pat; ctx.lineWidth = 34; ctx.lineJoin = 'round';
            ctx.beginPath();
            for (let x = 0; x <= CW; x += 8) (x === 0 ? ctx.moveTo(x, topAt(x)) : ctx.lineTo(x, topAt(x)));
            ctx.stroke();
        }
        const shade = ctx.createLinearGradient(0, CHT * 0.4, 0, CHT);     // lit top, darker body
        shade.addColorStop(0, 'rgba(255,255,255,0.12)'); shade.addColorStop(0.35, 'rgba(0,0,0,0.12)'); shade.addColorStop(1, 'rgba(0,0,0,0.45)');
        ctx.fillStyle = shade; ctx.fillRect(0, 0, CW, CHT);
        ctx.restore();

        // Decor, rooted on the ground, only where it fits inside the chunk (no cut-offs).
        const list = DECOR[biome.id] || DECOR.reef;
        const total = list.reduce((a, e) => a + e[1], 0);
        const pick = () => { let k = r() * total; for (const e of list) { k -= e[1]; if (k <= 0) return e; } return list[0]; };
        const items = [];
        for (let n = 0; n < d.items; n++) {
            const [tex, , f] = pick();
            if (!scene.textures.exists(tex)) continue;
            const img = scene.textures.get(tex).getSourceImage();
            const hgt = CHT * d.size * f * (0.65 + r() * 0.5);
            const wid = hgt * img.width / img.height;
            const x = wid / 2 + 4 + r() * (CW - wid - 8);
            items.push({ img, x, wid, hgt, flip: r() < 0.5, tex });
        }
        items.sort((a, b) => b.hgt - a.hgt);                              // big first, small in front
        for (const it of items) {
            const y = topAt(it.x) + it.hgt * (it.tex === 'kelp' ? 0.02 : 0.08);   // a little into the ground: rooted
            ctx.save();
            ctx.translate(it.x, y);
            if (it.flip) ctx.scale(-1, 1);
            ctx.drawImage(it.img, -it.wid / 2, -it.hgt, it.wid, it.hgt);
            ctx.restore();
        }

        scene.textures.addCanvas(key, canvas);
        const img = scene.add.image(0, 0, key).setOrigin(0, 1).setScrollFactor(0).setDepth(d.depth);
        const fade = scene.add.image(0, 0, 'bl_fade').setOrigin(0, 0).setScrollFactor(0).setDepth(d.depth - 0.01);
        return { key, img, fade, biome };
    }

    destroy() {
        for (const l of this.layers) {
            for (const c of l.chunks.values()) { c.img.destroy(); c.fade.destroy(); this.scene.textures.remove(c.key); }
            l.chunks.clear();
        }
    }
}
