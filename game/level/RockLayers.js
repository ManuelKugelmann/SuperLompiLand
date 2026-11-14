import { ROCK_LAYERS, LAYER_CHUNK, LAYER_SHADE } from './rockLayerTable.js';
import { materialTiles } from './materials.js';
import { mix } from './layerMath.js';
import { LEVEL } from './LevelGenerator.js';

/**
 * Near and mid-range rock behind the play plane (rockLayerTable.js): per layer, chunks of a
 * second procedural rock field shaded in the terrain worker (stone materials, soft unlit
 * rims, fog toward the water baked in), shown as plain images with the layer's scroll factor,
 * fading in. At most one chunk is put on screen per frame; nothing is redrawn while
 * playing. Without a worker the layers stay empty (the game looks fine without them).
 *
 *   create():  this.rockLayers = new RockLayers(this)   (after the LevelGenerator: it needs the materials)
 *   update():  this.rockLayers.update(camX, camY)
 */
const FADE_IN_MS = 600;     // a new chunk fades in over this long (never pops in with hard edges)

export default class RockLayers {
    constructor(scene) {
        this.scene = scene;
        this.layers = ROCK_LAYERS.map(def => ({ def, chunks: new Map() }));   // "cx,cy" -> { img, key } | 'pending'
        this.ready = [];
        try {
            this.worker = new Worker(new URL('./terrainWorker.js', import.meta.url), { type: 'module' });
            this.worker.onmessage = e => this.ready.push(e.data);
            this.worker.onerror = () => { this.worker = null; };
            const mats = materialTiles();
            if (mats) this.worker.postMessage({ materials: mats });
        } catch { this.worker = null; }
    }

    update(camX, camY) {
        if (!this.worker) return;
        const scene = this.scene, W = scene.scale.width, H = scene.scale.height, L = LAYER_CHUNK;
        this.layers.forEach((l, li) => {
            const s = l.def.s, lx = camX * s, ly = camY * s;
            const x0 = Math.floor(lx / L) - 1, x1 = Math.floor((lx + W) / L) + 1;
            const y0 = Math.max(0, Math.floor(ly / L) - 1), y1 = Math.floor((ly + H) / L) + 1;
            for (let cy = y0; cy <= y1; cy++) {
                for (let cx = x0; cx <= x1; cx++) {
                    const id = `${cx},${cy}`;
                    if (l.chunks.has(id)) continue;
                    l.chunks.set(id, 'pending');
                    this.worker.postMessage({ seed: LEVEL.seed, key: id, layer: li, cx, cy });
                }
            }
            for (const [id, c] of l.chunks) {
                const [cx, cy] = id.split(',').map(Number);
                if (cx >= x0 - 1 && cx <= x1 + 1 && cy >= y0 - 1 && cy <= y1 + 1) continue;
                if (c !== 'pending') { scene.tweens.killTweensOf(c.img); c.img.destroy(); scene.textures.remove(c.key); }
                l.chunks.delete(id);
            }
        });
        // Show at most one finished chunk per frame; ones nobody waits for any more are dropped.
        while (this.ready.length) {
            const r = this.ready.shift(), l = this.layers[r.layer];
            if (l.chunks.get(r.key) !== 'pending') continue;
            l.chunks.set(r.key, this.show(l.def, r));
            break;
        }
    }

    show(def, r) {
        const scene = this.scene, L = LAYER_CHUNK, S = LAYER_SHADE.rockSize;
        const [cx, cy] = r.key.split(',').map(Number);
        const key = `rl:${def.id}:${r.key}`;
        if (scene.textures.exists(key)) scene.textures.remove(key);
        const tex = scene.textures.createCanvas(key, S, S);
        tex.context.putImageData(new ImageData(new Uint8ClampedArray(r.rock.buffer), S, S), 0, 0);
        tex.refresh();
        // The fog toward the water is baked in by the worker (fogLayer); a slight darkening on top.
        const img = scene.add.image(cx * L, cy * L, key).setOrigin(0).setScrollFactor(def.s)
            .setDisplaySize(L + 1, L + 1).setDepth(def.depth).setTint(mix(0xffffff, 0x000000, 1 - def.dark)).setAlpha(0);
        scene.tweens.add({ targets: img, alpha: 1, duration: FADE_IN_MS });
        return { img, key };
    }

    destroy() {
        this.worker?.terminate();
        for (const l of this.layers) {
            for (const c of l.chunks.values()) if (c !== 'pending') { c.img.destroy(); this.scene.textures.remove(c.key); }
            l.chunks.clear();
        }
    }
}
