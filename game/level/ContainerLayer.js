import { CONTAINERS, containerSpan, containerField } from './containers.js';
import BonusCoins from './BonusCoins.js';

export const CONTAINER_LOOK = {
    near: 3400, far: 5200,   // px from the field at which it is built, and beyond which it is removed
    depth: 2.4,          // behind the fish: it swims in front of a container's far wall, through its open ends
    coinDepth: 2.6,
    paints: [['#a8452f', '#7c2f20'], ['#2f6f9a', '#214d6c'], ['#3d8a6e', '#2a614d']],   // rust red, sea blue, green: [side, shade]
    seen: 900            // px from a container at which the field counts as seen (reef book)
};

const key = i => `container_${i}`;

/** The painted containers (loaded by the title screen; container_2's doors hang open); drawn procedurally while missing. */
export const CONTAINER_ART = Object.fromEntries([0, 1, 2].map(i => [key(i), `img/container_${i}.webp`]));

/** Fallback pictures, one per paint: a corrugated steel box seen from the side, both ends open, weed along its lower edge. */
function ensureTextures(scene) {
    CONTAINER_LOOK.paints.forEach(([side, shade], i) => {
        if (scene.textures.exists(key(i))) return;
        const W = 490, H = 200, tex = scene.textures.createCanvas(key(i), W, H), c = tex.getContext();
        c.fillStyle = '#10202c'; c.fillRect(6, 10, W - 12, H - 20);                    // the dark inside, seen through the open ends
        c.fillStyle = side; c.fillRect(40, 10, W - 80, H - 20);                        // the long side wall
        c.fillStyle = shade;
        for (let x = 48; x < W - 48; x += 22) c.fillRect(x, 14, 9, H - 28);            // corrugation
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(40, H - 46, W - 80, 36);          // shade toward the floor
        c.strokeStyle = '#d7dade'; c.lineWidth = 6; c.strokeRect(6, 10, W - 12, H - 20);   // the frame
        c.fillStyle = 'rgba(190,120,60,0.55)';
        for (const [x, y, r] of [[90, 40, 12], [230, 150, 16], [370, 60, 10], [420, 140, 13]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }   // rust
        c.strokeStyle = 'rgba(70,120,70,0.85)'; c.lineWidth = 4; c.lineCap = 'round';
        for (let x = 20; x < W - 10; x += 26) { c.beginPath(); c.moveTo(x, H - 10); c.quadraticCurveTo(x + 6, H + 2, x + 2, H - 1 + (x % 3) * 4); c.stroke(); }   // weed
        tex.refresh();
    });
}

/**
 * What the container field looks like (level/containers.js says where the containers hang):
 * one picture each, rocking in the swell, and a line of coins through the ones the route runs
 * through. Built only while the fish is near. `onCoin(x, y)` for every coin taken, `onSeen()`
 * once at first sight.
 */
export default class ContainerLayer {
    constructor(scene, routeY, onCoin, onSeen) {
        this.scene = scene; this.onCoin = onCoin; this.onSeen = onSeen; this.seen = false;
        this.span = containerSpan();
        this.boxes = containerField(routeY);
        ensureTextures(scene);
        this.live = null;      // { imgs: [image per container], coins: [BonusCoins] }
        this.taken = new Set();      // coins taken stay gone for this run ("container id:coin number")
    }

    build() {
        const s = this.scene, L = CONTAINER_LOOK, [len, h] = CONTAINERS.size;
        const imgs = this.boxes.map(b => s.add.image(b.x, b.y, key(b.paint)).setDisplaySize(len, h).setRotation(b.tilt).setDepth(L.depth));
        const coins = this.boxes.filter(b => b.through).map(b => {
            const left = b.coins.map((p, k) => ({ ...p, k })).filter(p => !this.taken.has(`${b.id}:${p.k}`));
            return new BonusCoins(s, left, L.coinDepth, (x, y) => { const p = left.find(q => q.x === x && q.y === y); if (p) this.taken.add(`${b.id}:${p.k}`); this.onCoin(x, y); });
        });
        return { imgs, coins };
    }

    /** Per frame. `fish` = { x, y }, `radius` its radius, `t` s. */
    update(fish, radius, t) {
        const L = CONTAINER_LOOK, sp = this.span;
        if (this.live && (fish.x < sp.x0 - L.far || fish.x > sp.x1 + L.far)) { for (const o of this.live.imgs) o.destroy(); for (const c of this.live.coins) c.destroy(); this.live = null; }
        if (!this.live) {
            if (fish.x < sp.x0 - L.near || fish.x > sp.x1 + L.near || !this.scene.buildSlot()) return;
            this.live = this.build();
        }
        const [bob, rock] = CONTAINERS.bob;
        this.live.imgs.forEach((img, i) => {
            const b = this.boxes[i];
            // The ones the fish swims through keep still enough for their coins; the others rise and fall in the swell.
            if (!b.through) img.setY(b.y + Math.sin(t * 0.7 + i * 1.9) * bob);
            img.setRotation(b.tilt + Math.sin(t * 0.5 + i * 2.3) * rock * (b.through ? 0.3 : 1));
            if (!this.seen && Math.hypot(fish.x - b.x, fish.y - b.y) < L.seen) { this.seen = true; this.onSeen(); }
        });
        for (const c of this.live.coins) c.update(fish, radius, t);
    }
}
