import { SPECIES, fishTexture } from '../ai/SwarmLayer.js';
import { SWIRL, baitballSlot, ballCentre, fishAt, hiddenIn, plungeAt, plungeCoins } from './baitball.js';

export const BAITBALL_LOOK = {
    near: 2600, far: 4000,   // px: a ball is built this close to the fish and removed beyond that
    depth: [4.7, 5.25],      // behind Lompi, and in front of it (the swirl closes round a hidden fish)
    flashAt: 0.6,            // how edge-on a fish turns before its flank flashes silver
    bump: 130,               // px: fish this close to Lompi make way
    gannet: 150,             // px long, diving
    coin: 64,                // px
    hiddenAlpha: 0.75,       // Lompi, hidden in the swirl
    coreFade: 0.5,           // how much of the core's fish the water swallows
    fishSize: 30             // px: the sardines, a little bigger than a far school (they are right here)
};

const C = {}, F = {}, P = {};

/**
 * The bait ball in the open blue (level/baitball.js says where it is and how it moves): two
 * Blitters of silver fish, half behind and half in front of Lompi, a diving gannet and the
 * coins its plunges leave. Built only near the fish. `onCoin(x, y)` = a coin was taken,
 * `splash(x)` = a gannet hit the water, `onSeen()` = the fish first came close (once).
 */
export default class BaitBallLayer {
    constructor(scene, routeY, surfaceY, onCoin, splash, onSeen) {
        Object.assign(this, { scene, routeY, surfaceY, onCoin, splash, onSeen });
        this.slot = baitballSlot();
        this.live = null;        // { blitters, bobs, gannet, coins, plunge }
        this.hidden = false;
        this.seen = false;
    }

    build() {
        const s = this.scene, L = BAITBALL_LOOK, key = fishTexture(s, 'baitball', { ...SPECIES.silverside, size: L.fishSize, art: 'silverside' });
        const blitters = L.depth.map(d => s.add.blitter(0, 0, key).setDepth(d)), bobs = [];
        for (let i = 0; i < SWIRL.count; i++) {
            fishAt(i, 0, F);
            bobs.push({ bob: blitters[F.front ? 1 : 0].create(0, 0, 1), i, ox: 0, oy: 0 });
        }
        const gannet = s.textures.exists('gannet_dive') ? s.add.image(0, 0, 'gannet_dive').setDepth(3.55).setVisible(false) : null;
        if (gannet) gannet.setScale(L.gannet / gannet.height);
        return { blitters, bobs, gannet, coins: [], plunge: -1, w: s.textures.get(key).get(1).width, h: s.textures.get(key).get(1).height };
    }

    drop() {
        const v = this.live;
        for (const b of v.blitters) b.destroy();
        v.gannet?.destroy();
        for (const c of v.coins) c.img.destroy();
        this.live = null;
    }

    /** Per frame. `fish` = { x, y }, `view` = the fish's drawn image (faded while hidden), `t` s. */
    update(fish, view, radius, t) {
        const L = BAITBALL_LOOK;
        const d = Math.abs(fish.x - this.slot.x);
        if (this.live && d > L.far) this.drop();
        if (!this.live) {
            if (d > L.near || !this.scene.buildSlot()) { this.setHidden(view, false); return; }
            this.live = this.build();
        }
        const v = this.live, c = ballCentre(t, this.routeY, C);
        if (!this.seen && Math.hypot(fish.x - c.x, fish.y - c.y) < SWIRL.radius * 1.5) { this.seen = true; this.onSeen(); }
        // Fish: round the swirl, making way round Lompi, flashing when they turn.
        for (const f of v.bobs) {
            fishAt(f.i, t, F);
            const x = c.x + F.x, y = c.y + F.y, dx = x - fish.x, dy = y - fish.y, d = Math.hypot(dx, dy);
            const push = d < L.bump ? (L.bump - d) / Math.max(d, 1) : 0;
            f.ox += (dx * push - f.ox) * 0.15; f.oy += (dy * push - f.oy) * 0.15;
            f.bob.flipX = F.dir < 0;
            f.bob.alpha = 1 - L.coreFade * F.core;      // the water shows through the deep core: darker, bluer
            f.bob.setFrame(F.turn > L.flashAt ? 3 : Math.floor(t * 9 + f.i) % 3);
            f.bob.x = x + f.ox - v.w / 2; f.bob.y = y + f.oy - v.h / 2;
        }
        this.setHidden(view, hiddenIn(fish.x - c.x, fish.y - c.y));
        // A gannet's plunge: from the sky, through the surface, into the top of the ball.
        plungeAt(t, P);
        const sy = this.surfaceY(c.x + P.dx), top = c.y - SWIRL.radius * SWIRL.squash;
        if (v.gannet) {
            const falling = P.u < 1, y0 = sy - SWIRL.plunge.sky;
            v.gannet.setVisible(falling);
            if (falling) v.gannet.setPosition(c.x + P.dx, y0 + (top - y0) * P.u * P.u).setRotation(Math.PI / 2 * 0.15);
        }
        if (P.u >= 1 && v.plunge !== P.n) {
            v.plunge = P.n;
            this.splash(c.x + P.dx);
            for (const p of plungeCoins(P, sy - c.y)) {
                const img = this.scene.textures.exists('coin')
                    ? this.scene.add.image(c.x + p.x, c.y + p.y, 'coin').setDisplaySize(L.coin, L.coin)
                    : this.scene.add.circle(c.x + p.x, c.y + p.y, L.coin / 2, 0xffd23f);
                v.coins.push({ img: img.setDepth(2.5), born: t });
            }
        }
        // Coins: taken by touch, fading away after a while.
        v.coins = v.coins.filter(k => {
            const age = t - k.born, life = SWIRL.plunge.life;
            if (Math.hypot(k.img.x - fish.x, k.img.y - fish.y) < radius + L.coin / 2) { this.onCoin(k.img.x, k.img.y); k.img.destroy(); return false; }
            if (age > life) { k.img.destroy(); return false; }
            k.img.setAlpha(Math.min(1, (life - age) / 1.5));
            return true;
        });
    }

    setHidden(view, on) {
        if (on === this.hidden) return;
        this.hidden = on;
        view?.setAlpha?.(on ? BAITBALL_LOOK.hiddenAlpha : 1);
    }

}
