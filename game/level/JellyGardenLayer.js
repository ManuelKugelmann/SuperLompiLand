import BonusCoins from './BonusCoins.js';
import { JELLY_GARDEN, gardenSpot, jellyAt, pulseAt, gardenLift, gardenCoins } from './jellyGarden.js';

/**
 * What the upside-down jellyfish garden looks like (level/jellyGarden.js says where and how it
 * lifts): jellies lying bell-down on the mud with their frilly arms up, squeezing in turn, and
 * coins over the thickest patch. Built only while the fish is near.
 *
 *   create():  this.jellyGarden = new JellyGardenLayer(scene, groundY, onCoin, onSeen)
 *   update():  this.jellyGarden.update(fish, t)
 *   waterAt(): this.jellyGarden.flowAt(x, y, t, out)   the pulses' lift (px/step)
 */
export const GARDEN_LOOK = {
    near: 3000, far: 4500,   // px from the garden at which it is built, and beyond which it is removed
    depth: 3.2,              // on the mud, in front of the pebbles and props, just behind the fish
    squeeze: 0.22            // how much a bell flattens and widens at the squeeze
};

const KEY = 'cassiopea';

/** The painted jelly (loaded by the title screen); drawn while missing. */
export const GARDEN_ART = { [KEY]: 'img/cassiopea.webp' };

function ensureTexture(scene) {
    if (scene.textures.exists(KEY)) return;
    // Side view, a little from above: a pale bell lying on the mud, and on it a raised crown of
    // frilly brown-green arms with blue-white tips (the algae they farm), so it reads as an animal.
    const W = 200, H = 140, t = scene.textures.createCanvas(KEY, W, H), c = t.getContext(), TAU = Math.PI * 2;
    const bell = c.createLinearGradient(0, H - 40, 0, H);
    bell.addColorStop(0, '#c9dbe2'); bell.addColorStop(1, '#6f8a96');
    c.fillStyle = bell; c.beginPath(); c.ellipse(W / 2, H - 18, W * 0.46, 18, 0, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 3; c.beginPath(); c.ellipse(W / 2, H - 22, W * 0.42, 12, 0, Math.PI, TAU); c.stroke();
    for (let i = 0; i < 8; i++) {
        const a = Math.PI * (0.08 + 0.84 * i / 7), x0 = W / 2 - Math.cos(a) * W * 0.12, x1 = W / 2 - Math.cos(a) * W * 0.36, y1 = H - 40 - Math.sin(a) * 70;
        c.strokeStyle = '#6d5a3a'; c.lineWidth = 9; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x0, H - 30); c.quadraticCurveTo((x0 + x1) / 2, y1 + 20, x1, y1); c.stroke();
        for (let k = 0; k < 6; k++) {
            const r = 7 + (k % 3) * 2, fx = x1 + Math.cos(k * 1.9 + i) * 12, fy = y1 + Math.sin(k * 2.4 + i) * 10;
            c.fillStyle = k % 2 ? '#7a8f4e' : '#8b6e45'; c.beginPath(); c.arc(fx, fy, r, 0, TAU); c.fill();
        }
        c.fillStyle = '#bfe6f0'; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(x1 + Math.cos(k * 2.1) * 9, y1 - 4 + Math.sin(k * 2.1) * 7, 3, 0, TAU); c.fill(); }
    }
    t.refresh();
}

export default class JellyGardenLayer {
    constructor(scene, groundY, onCoin, onSeen) {
        this.scene = scene; this.groundY = groundY; this.onCoin = onCoin; this.onSeen = onSeen;
        this.spot = gardenSpot();
        this.jellies = Array.from({ length: JELLY_GARDEN.count }, (_, i) => jellyAt(i));
        this.ground = 0;
        this.seen = false;
        this.taken = new Set();      // coins taken stay gone for the run
        ensureTexture(scene);
        this.live = null;
    }

    build() {
        const s = this.scene, src = s.textures.get(KEY).getSourceImage(), items = [];
        for (const j of this.jellies) {
            const g = this.groundY(j.x);
            if (g === null) continue;
            const img = s.add.image(j.x, g + 6, KEY).setOrigin(0.5, 1).setDepth(GARDEN_LOOK.depth);
            img.setScale(j.size / src.width);
            j.base = img.scale;
            j.img = img;
            items.push(img);
        }
        const mid = this.spot.x0 + JELLY_GARDEN.patch * (this.spot.x1 - this.spot.x0);
        this.ground = this.groundY(mid) ?? 0;
        const points = gardenCoins(this.ground).map((p, k) => ({ ...p, id: k })).filter(p => !this.taken.has(p.id));
        const coins = new BonusCoins(s, points, 2.2, (x, y) => { const p = points.find(q => q.x === x && q.y === y); if (p) this.taken.add(p.id); this.onCoin(x, y); });
        return { items, coins };
    }

    /** Per frame. `fish` = { x, y, radius }, `t` s. */
    update(fish, t) {
        const L = GARDEN_LOOK, sp = this.spot;
        if (this.live && (fish.x < sp.x0 - L.far || fish.x > sp.x1 + L.far)) this.clear();
        if (!this.live) {
            if (fish.x < sp.x0 - L.near || fish.x > sp.x1 + L.near || !this.scene.buildSlot()) return;
            this.live = this.build();
        }
        for (const j of this.jellies) {
            if (!j.img) continue;
            const p = pulseAt(j, t);
            j.img.setScale(j.base * (1 + L.squeeze * p * 0.6), j.base * (1 - L.squeeze * p));
        }
        this.live.coins.update(fish, fish.radius || 40, t);
        const mid = (sp.x0 + sp.x1) / 2;
        if (!this.seen && Math.abs(fish.x - mid) < JELLY_GARDEN.seen) { this.seen = true; this.onSeen('jelly_garden'); }
    }

    /** The pulses' lift at (x, y) into out (px/step); none while the garden is not built. */
    flowAt(x, y, t, out) {
        out.x = 0; out.y = 0;
        if (!this.live || x < this.spot.x0 - 200 || x > this.spot.x1 + 200) return out;
        const g = this.groundY(x);
        return g === null ? out : gardenLift(x, y, g, t, this.jellies, out);
    }

    clear() {
        for (const o of this.live.items) o.destroy();
        this.live.coins.destroy();
        for (const j of this.jellies) j.img = null;
        this.live = null;
    }
}
