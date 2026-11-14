import { CONTAINERS, containerSpan, containerField, containerCoins, landsOnRoof, roofBounce } from './containers.js';
import BonusCoins from './BonusCoins.js';

export const CONTAINER_LOOK = {
    near: 3400, far: 5200,   // px from the field at which it is built, and beyond which it is removed
    depth: 2.4,          // behind the fish: it swims in front of a container's far wall, through the open one's ends
    coinDepth: 2.6,
    paints: [['#a8452f', '#7c2f20'], ['#2f6f9a', '#214d6c'], ['#3d8a6e', '#2a614d']],   // rust red, sea blue, green: [side, shade]
    seen: 900            // px from a container at which the field counts as seen (reef book)
};

const key = i => `container_${i}`;

/** The painted containers (loaded by the title screen; container_2's doors hang open); drawn procedurally while missing. */
export const CONTAINER_ART = Object.fromEntries([0, 1, 2].map(i => [key(i), `img/container_${i}.webp`]));

/** Fallback pictures, one per paint: a corrugated steel box seen from the side, weed along its lower edge (painted files under the same keys replace them). */
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
 * What the container field looks like (level/containers.js says where the containers float):
 * one picture each, lying in the water's surface and rocking with it, a soft shadow under each,
 * and the field's coins. Built only while the fish is near. `surfaceY(x)` = height of the water
 * surface, `onCoin(x, y)` for every coin taken, `onSeen()` once at first sight, `onBounce(x, y)`
 * when a leaping fish bounces off a container's roof.
 */
export default class ContainerLayer {
    constructor(scene, routeY, surfaceY, onCoin, onSeen, onBounce) {
        this.scene = scene; this.surfaceY = surfaceY; this.onCoin = onCoin; this.onSeen = onSeen; this.onBounce = onBounce; this.seen = false;
        this.bouncedAt = -Infinity;
        this.span = containerSpan();
        this.boxes = containerField();
        this.coinSpots = containerCoins(routeY);
        ensureTextures(scene);
        this.live = null;      // { imgs, shadows, coins }
        this.taken = new Set();      // coins taken stay gone for this run (their number in coinSpots)
    }

    build() {
        const s = this.scene, L = CONTAINER_LOOK, [len, h] = CONTAINERS.size;
        const imgs = this.boxes.map(b => s.add.image(b.x, b.y, key(b.paint)).setDisplaySize(len, h).setRotation(b.tilt).setDepth(L.depth + (b.stacked ? 0.01 : 0)));
        // A soft dark patch in the water under each floating one.
        const shadows = this.boxes.map(b => b.stacked ? null : s.add.image(b.x, b.y + h * 0.75, 'bd_glow').setDisplaySize(len * 1.1, h * 1.3).setTint(0x041018).setAlpha(CONTAINERS.shadow).setDepth(L.depth - 0.1));
        const left = this.coinSpots.map((p, k) => ({ ...p, k })).filter(p => !this.taken.has(p.k));
        const coins = new BonusCoins(s, left, L.coinDepth, (x, y) => { const p = left.find(q => q.x === x && q.y === y); if (p) this.taken.add(p.k); this.onCoin(x, y); });
        return { imgs, shadows, coins };
    }

    /** Per frame. `fish` = the fish's body sprite (x, y, body.velocity, setVelocity), `radius` its radius, `t` s, `inAir` = it is above the water. */
    update(fish, radius, t, inAir) {
        const L = CONTAINER_LOOK, sp = this.span;
        if (this.live && (fish.x < sp.x0 - L.far || fish.x > sp.x1 + L.far)) {
            for (const o of [...this.live.imgs, ...this.live.shadows]) o?.destroy();
            this.live.coins.destroy(); this.live = null;
        }
        if (!this.live) {
            if (fish.x < sp.x0 - L.near || fish.x > sp.x1 + L.near || !this.scene.buildSlot()) return;
            this.live = this.build();
        }
        const half = CONTAINERS.size[0] * 0.3;
        this.live.imgs.forEach((img, i) => {
            const b = this.boxes[i];
            // It lies in the surface: it rises and falls with the water under its middle and tips with the slope between its ends.
            const mid = this.surfaceY(b.x), slope = Math.atan2(this.surfaceY(b.x + half) - this.surfaceY(b.x - half), half * 2);
            img.setY(mid + b.y).setRotation(b.tilt + slope * 0.6 + Math.sin(t * 0.5 + i * 2.3) * CONTAINERS.rock);
            this.live.shadows[i]?.setY(mid + b.y + CONTAINERS.size[1] * 0.75);
            if (!this.seen && Math.hypot(fish.x - b.x, fish.y - (mid + b.y)) < L.seen) { this.seen = true; this.onSeen(); }
            // A leap that comes down on its roof bounces off, like off a pad.
            const v = fish.body.velocity;
            if (inAir && t - this.bouncedAt > CONTAINERS.roof.again && landsOnRoof(b, mid, fish.x, fish.y + radius, v.y)) {
                this.bouncedAt = t;
                fish.setVelocity(v.x, roofBounce(v.y));
                this.onBounce(fish.x, fish.y + radius);
            }
        });
        this.live.coins.update(fish, radius, t);
    }
}
