import { ROCK_LAYERS, LAYER_CHUNK, layerSize } from './rockLayerTable.js';
import { materialTiles } from './materials.js';
import { mix } from './layerMath.js';
import { LEVEL } from './LevelGenerator.js';
import ChunkAtlas from './ChunkAtlas.js';
import { createPool, poolSize } from './workerPool.js';

/**
 * Near and mid-range rock behind the play plane (rockLayerTable.js): per layer, chunks of a
 * second procedural rock field shaded in the terrain worker (stone materials, soft unlit
 * rims, fog toward the water baked in), shown as plain images with the layer's scroll factor,
 * fading in. At most one chunk is put on screen per frame; nothing is redrawn while
 * playing. Each layer's chunks share one atlas texture (ChunkAtlas: the worker's pixels go
 * straight to the graphics card, no canvas, one texture for the whole layer); where there is no
 * atlas, a canvas each from the chunk canvas pool (LevelGenerator canvasFor / poolCanvas). Without
 * a worker the layers stay empty (the game looks fine without them).
 *
 *   create():  this.rockLayers = new RockLayers(this)   (after the LevelGenerator: it needs the materials)
 *   update():  this.rockLayers.update(camX, camY)
 */
const FADE_IN_MS = 600;     // a new chunk fades in over this long (never pops in with hard edges)
// Ahead of a fast swimmer (user: "world gen not as fast as fish, look ahead, no popping": back rock faded in at the screen's edge):
// chunks are asked for as far ahead as the view covers in `leadS` seconds (at most `leadMax` more), nearest first, from a pool of workers.
const LAYER_LEAD = { leadS: 2.5, leadMax: 2, ease: 0.15 };
const CULL_MARGIN = 32;     // px round the screen within which a layer chunk is drawn
const ATLAS_CHUNKS = 25;    // chunks a layer's atlas holds: the wanted window on a phone in landscape and part of the ring kept round it (a full one drops the furthest kept chunk)

export default class RockLayers {
    constructor(scene) {
        this.scene = scene;
        this.layers = ROCK_LAYERS.map(def => ({ def, chunks: new Map(), atlas: this.atlasFor(def) }));   // "cx,cy" -> { img, key | place } | 'pending'
        this.ready = [];
        // A lost WebGL context comes back with empty textures: the layers' chunks are dropped and asked for again.
        const r = scene.game.renderer, restore = () => { for (const l of this.layers) { for (const c of l.chunks.values()) if (c !== 'pending') this.drop(l, c); l.chunks.clear(); } this.ready.length = 0; };
        if (r?.on) { r.on('restorewebgl', restore); this.offRestore = () => r.off('restorewebgl', restore); }
        try {
            this.worker = createPool(() => new Worker(new URL('./terrainWorker.js', import.meta.url), { type: 'module' }), poolSize(navigator.hardwareConcurrency));
            this.worker.onmessage = e => { const r = e.data; r.id = r.key.slice(r.key.indexOf(':') + 1); this.ready.push(r); };      // key = 'layer:cx,cy' (unique across the layers for the pool)
            this.worker.onerror = () => { this.worker = null; };
            const mats = materialTiles();
            if (mats) this.worker.postMessage({ materials: mats });
        } catch { this.worker = null; }
    }

    /** A layer's atlas, made once per game (kept in its registry, emptied for a new scene), or null without WebGL. */
    atlasFor(def) {
        const reg = this.scene.registry, id = `rockAtlas:${def.id}`, a = reg.get(id);
        if (a && this.scene.textures.exists(a.key)) { a.reset(); return a; }
        const made = ChunkAtlas.make(this.scene, `rock_atlas_${def.id}`, layerSize(def), ATLAS_CHUNKS);
        reg.set(id, made);
        return made;
    }

    /** Let a shown chunk go: its picture, and its place in the atlas or its canvas. */
    drop(l, c) {
        this.scene.tweens.killTweensOf(c.img); c.img.destroy();
        if (c.place !== undefined) l.atlas.give(c.place); else this.scene.level.poolCanvas(c.key);
    }

    update(camX, camY) {
        if (!this.worker) return;
        const scene = this.scene, W = scene.scale.width, H = scene.scale.height, L = LAYER_CHUNK, A = LAYER_LEAD;
        // The view's speed (px per s, eased; a jump is not a speed), for the look-ahead.
        const dt = Math.max(1e-3, scene.game.loop.delta / 1000), v = this.vel || (this.vel = { x: 0, y: 0, at: null });
        if (v.at && Math.abs(camX - v.at.x) < W && Math.abs(camY - v.at.y) < H) { const k = 1 - Math.pow(1 - A.ease, dt * 60); v.x += ((camX - v.at.x) / dt - v.x) * k; v.y += ((camY - v.at.y) / dt - v.y) * k; }
        v.at = { x: camX, y: camY };
        this.layers.forEach((l, li) => {
            const s = l.def.s, lx = camX * s, ly = camY * s;
            const ax = Math.min(A.leadMax, Math.ceil(Math.abs(v.x) * s * A.leadS / L)), ay = Math.min(A.leadMax, Math.ceil(Math.abs(v.y) * s * A.leadS / L));
            const x0 = Math.floor(lx / L) - 1 - (v.x < 0 ? ax : 0), x1 = Math.floor((lx + W) / L) + 1 + (v.x > 0 ? ax : 0);
            const y0 = Math.max(0, Math.floor(ly / L) - 1 - (v.y < 0 ? ay : 0)), y1 = Math.floor((ly + H) / L) + 1 + (v.y > 0 ? ay : 0);
            const want = [];
            for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (!l.chunks.has(`${cx},${cy}`)) want.push([cx, cy]);
            const mx = (lx + W / 2) / L - 0.5, my = (ly + H / 2) / L - 0.5;
            want.sort((a, b) => Math.hypot(a[0] - mx, a[1] - my) - Math.hypot(b[0] - mx, b[1] - my));      // nearest the view first
            for (const [cx, cy] of want) {
                const id = `${cx},${cy}`;
                l.chunks.set(id, 'pending');
                this.worker.postMessage({ seed: LEVEL.seed, key: `${li}:${id}`, layer: li, cx, cy });
            }
            for (const [id, c] of l.chunks) {
                const [cx, cy] = c === 'pending' ? id.split(',').map(Number) : c.at;
                if (cx >= x0 - 1 && cx <= x1 + 1 && cy >= y0 - 1 && cy <= y1 + 1) {
                    // Kept round the view, drawn only where it is on screen (Phaser draws every visible picture, on screen or not).
                    if (c !== 'pending') c.img.visible = cx * L + L > lx - CULL_MARGIN && cx * L < lx + W + CULL_MARGIN && cy * L + L > ly - CULL_MARGIN && cy * L < ly + H + CULL_MARGIN;
                    continue;
                }
                if (c !== 'pending') this.drop(l, c);
                l.chunks.delete(id);
            }
            l.want = [x0, x1, y0, y1, lx + W / 2, ly + H / 2];
        });
        // Show at most one finished chunk per frame; ones nobody waits for any more are dropped. One whose layer has no room
        // yet waits in the queue, and the next chunk gets its turn (review: a full layer at the head starved the other layer).
        for (let k = 0; k < this.ready.length; k++) {
            const r = this.ready[k], l = this.layers[r.layer];
            if (l.chunks.get(r.id) !== 'pending') { this.ready.splice(k--, 1); continue; }
            const shown = this.show(l, r);
            if (!shown) continue;
            this.ready.splice(k, 1);
            l.chunks.set(r.id, shown);
            break;
        }
    }

    /** A free place in the layer's atlas; when it is full, the kept chunk furthest outside the wanted window gives its place up. */
    place(l) {
        let i = l.atlas.take();
        if (i !== null) return i;
        const [x0, x1, y0, y1, mx, my] = l.want, L = LAYER_CHUNK;
        let far = null, best = -1;
        for (const [id, c] of l.chunks) {
            if (c === 'pending') continue;
            const [cx, cy] = id.split(',').map(Number);
            if (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1) continue;
            const d = Math.hypot((cx + 0.5) * L - mx, (cy + 0.5) * L - my);
            if (d > best) { best = d; far = id; }
        }
        if (far === null) return null;
        this.drop(l, l.chunks.get(far)); l.chunks.delete(far);
        return l.atlas.take();
    }

    /** A finished chunk on screen: { img, place } in the atlas (or { img, key } on a canvas), or null when the atlas has no room yet. */
    show(l, r) {
        const scene = this.scene, L = LAYER_CHUNK, def = l.def, S = layerSize(def);
        const [cx, cy] = r.id.split(',').map(Number);
        let tex, frame, out;
        if (l.atlas) {
            const i = this.place(l);
            if (i === null) return null;
            l.atlas.upload(i, r.rock, 0, S);
            tex = l.atlas.key; frame = String(i); out = { place: i };
        } else {
            const key = `rl:${def.id}:${r.key}`;
            if (scene.textures.exists(key)) scene.textures.remove(key);
            const canvas = scene.level.canvasFor(key, S, S);
            canvas.context.putImageData(new ImageData(new Uint8ClampedArray(r.rock.buffer), S, S), 0, 0);
            canvas.refresh();
            tex = key; out = { key };
        }
        // The fog toward the water is baked in by the worker (fogLayer); a slight darkening on top.
        const img = scene.add.image(cx * L, cy * L, tex, frame).setOrigin(0).setScrollFactor(def.s)
            .setDisplaySize(L + 1, L + 1).setDepth(def.depth).setTint(mix(0xffffff, 0x000000, 1 - def.dark)).setAlpha(0);
        scene.tweens.add({ targets: img, alpha: 1, duration: FADE_IN_MS });
        return { img, at: [cx, cy], ...out };
    }

    destroy() {
        this.offRestore?.();
        this.worker?.terminate();
        for (const l of this.layers) {
            for (const c of l.chunks.values()) if (c !== 'pending') this.drop(l, c);
            l.chunks.clear();
        }
    }
}
