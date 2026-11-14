import { RAFTS, FLYERS, raftSpots, flyersAt, flyerAt } from './rafts.js';
import { mixColor, waterHue } from './biomes.js';

export const RAFT_LOOK = {
    near: 2600, far: 4200,   // px: a raft is built when the player is this close, removed beyond that
    waterline: 0.36,     // share of the picture's height at which it lies in the water
    rock: 0.035,         // radians it rocks on the swell
    wet: 0.45,           // how far the part under the surface takes on the water's hue
    depth: 4.8,          // just behind the fish
    flyer: 86,           // px length of a flying fish in a burst
    flyerDepth: 5.4
};

/** The painted raft (loaded by the title screen); drawn procedurally while missing. */
export const RAFT_ART = { sargassum: 'img/rescue/sargassum.webp' };

const KEY = 'sargassum', FLYER_KEY = 'player_flyingfish';

/** Fallback raft: a mat of golden-brown weed with float bladders. */
function ensureTexture(scene) {
    if (scene.textures.exists(KEY)) return;
    const W = 512, H = 150, tex = scene.textures.createCanvas(KEY, W, H), c = tex.getContext();
    c.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
        const x = 20 + (i * 53 % (W - 40)), y = H * 0.36 + Math.sin(i * 2.1) * 10, len = 26 + (i * 17 % 60);
        c.strokeStyle = i % 3 ? '#b8862f' : '#8a6424'; c.lineWidth = 5;
        c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.sin(i) * 26, y + len * 0.5, x + Math.sin(i * 1.7) * 34, y + (i % 4 ? len : -len * 0.4)); c.stroke();
    }
    c.fillStyle = '#c99a4a';
    for (let i = 0; i < 14; i++) { c.beginPath(); c.arc(40 + i * 33, H * 0.32 + Math.sin(i * 3.3) * 8, 9, 0, 7); c.fill(); }
    tex.refresh();
}

const P = {};

/**
 * Sargassum rafts floating on the open sea and bursts of flying fish (level/rafts.js says where
 * and how they fly). Rafts are built only near the player; a burst is a handful of pooled
 * pictures. `surfaceY(x)` = height of the water surface; `onSeen()` is called once, at the first raft.
 */
export default class RaftLayer {
    constructor(scene, surfaceY, onSeen) {
        this.scene = scene; this.surfaceY = surfaceY; this.onSeen = onSeen; this.seen = false;
        this.spots = raftSpots();
        ensureTexture(scene);       // drawn at start-up, not on first sight
        this.rafts = new Map();     // spot id -> [dry half, wet half]
        this.flyers = null;         // pooled pictures of one burst
        this.burstAt = null;        // { x, y, dir, seed, t0 }
        this.lastBurst = -Infinity;
    }

    /** The fish skipped off a wave at world x heading `dir`: out at sea, flying fish break the surface beside it. */
    skim(x, dir, t) {
        if (!flyersAt(x) || t - this.lastBurst < FLYERS.again || !this.scene.textures.exists(FLYER_KEY)) return;
        this.lastBurst = t;
        if (!this.flyers) {
            this.flyers = Array.from({ length: FLYERS.count }, () => {
                const img = this.scene.add.image(0, 0, FLYER_KEY).setDepth(RAFT_LOOK.flyerDepth).setVisible(false);
                return img.setScale(RAFT_LOOK.flyer / img.width);
            });
        }
        this.burstAt = { x, y: this.surfaceY(x), dir: dir < 0 ? -1 : 1, seed: x * 0.01 + t, t0: t };
    }

    /** Per frame. `fish` = { x, y }, `t` s. */
    update(fish, t) {
        const L = RAFT_LOOK;
        for (const spot of this.spots) {
            const d = Math.abs(spot.x - fish.x), img = this.rafts.get(spot.id);
            if (!img && d < L.near) {
                if (!this.scene.buildSlot()) continue;
                // Two halves of one picture: dry above the waterline, seen through the water below it.
                const half = wet => {
                    const r = this.scene.add.image(spot.x, 0, KEY).setOrigin(0.5, L.waterline).setDepth(L.depth), cut = r.height * L.waterline;
                    if (wet) r.setCrop(0, cut, r.width, r.height - cut).setTint(mixColor(0xffffff, waterHue(spot.x), L.wet));
                    else r.setCrop(0, 0, r.width, cut);
                    return r.setScale(RAFTS.width / r.width);
                };
                this.rafts.set(spot.id, [half(false), half(true)]);
            } else if (img && d > L.far) { for (const h of img) h.destroy(); this.rafts.delete(spot.id); } else if (img) {
                for (const h of img) h.setY(this.surfaceY(spot.x)).setRotation(Math.sin(t * 0.9 + spot.x) * L.rock);
                if (!this.seen && d < RAFTS.seen && fish.y < 700) { this.seen = true; this.onSeen(); }
            }
        }
        const b = this.burstAt;
        if (!b) return;
        let flying = false;
        this.flyers.forEach((img, i) => {
            const p = flyerAt(i, b.seed, b.x, b.y, b.dir, (t - b.t0) * 60, P);
            img.setVisible(p.out && !p.done);
            if (!p.done) flying = true;
            if (p.out && !p.done) img.setPosition(p.x, p.y).setFlipX(b.dir < 0).setRotation(p.angle * b.dir);
        });
        if (!flying) this.burstAt = null;
    }
}
