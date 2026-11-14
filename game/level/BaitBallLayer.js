import Phaser from 'phaser';
import { SPECIES, fishTexture } from '../ai/SwarmLayer.js';
import { SWIRL, baitballSlot, ballCentre, fishAt, hiddenIn, plungeAt, plungeCoins, plungeDepth } from './baitball.js';

export const BAITBALL_LOOK = {
    near: 2600, far: 4000,   // px: a ball is built this close to the fish and removed beyond that
    depth: [4.7, 5.25],      // behind Lompi, and in front of it (the swirl closes round a hidden fish)
    flashAt: 0.6,            // how edge-on a fish turns before its flank flashes silver
    bump: 130,               // px: fish this close to Lompi make way
    gannet: 150,             // px long, diving
    coin: 64,                // px
    hiddenAlpha: 0.75,       // Lompi, hidden in the swirl
    flash: 220, flashEdge: 40,   // px: the cue's size, and how far under the top of the view it shows when the surface is above it
    jetWidth: 34,            // px: the bubble jet behind the diving bird
    coreFade: 0.5,           // how much of the core's fish the water swallows
    fishSize: 30             // px: the sardines, a little bigger than a far school (they are right here)
};

const C = {}, F = {}, P = {};

/** A soft white glow (radial), baked once: the bubble jet and the cue's flash. */
function glowTexture(scene) {
    const key = 'baitball_glow';
    if (scene.textures.exists(key)) return key;
    const S = 64, tex = scene.textures.createCanvas(key, S, S), c = tex.getContext(), g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, S, S); tex.refresh();
    return key;
}

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
        const bird = k => (s.textures.exists(k) ? s.add.image(0, 0, k).setDepth(3.55).setVisible(false) : null);
        const gannet = bird('gannet_dive'), rising = bird('gannet_float');
        gannet?.setScale(L.gannet / gannet.height); rising?.setScale(L.gannet * 0.7 / rising.width);
        // The bubble jet behind the bird under water, and the flash on the surface before a dive.
        const soft = glowTexture(s);
        const jet = s.add.image(0, 0, soft).setOrigin(0.5, 1).setDepth(3.5).setVisible(false).setTint(0xeaf8ff);
        const flash = s.add.image(0, 0, soft).setDepth(6.2).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
        return { blitters, bobs, gannet, rising, jet, flash, coins: [], splashed: -1, hit: -1, puff: null,
            w: s.textures.get(key).get(1).width, h: s.textures.get(key).get(1).height };
    }

    drop() {
        const v = this.live;
        for (const b of v.blitters) b.destroy();
        for (const o of [v.gannet, v.rising, v.jet, v.flash]) o?.destroy();
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
            let px = dx * push, py = dy * push;
            if (v.puff) {      // scattered where the bird hit, closing in again
                const S = SWIRL.plunge.scatter, qx = x - v.puff.x, qy = y - v.puff.y, q = Math.hypot(qx, qy), age = t - v.puff.t;
                if (q < S.reach && age < S.fade) { const k = S.push * (1 - q / S.reach) * (1 - age / S.fade) / Math.max(q, 1); px += qx * k; py += qy * k; }
            }
            f.ox += (px - f.ox) * 0.15; f.oy += (py - f.oy) * 0.15;
            f.bob.flipX = F.dir < 0;
            f.bob.alpha = 1 - L.coreFade * F.core;      // the water shows through the deep core: darker, bluer
            f.bob.setFrame(F.turn > L.flashAt ? 3 : Math.floor(t * 9 + f.i) % 3);
            f.bob.x = x + f.ox - v.w / 2; f.bob.y = y + f.oy - v.h / 2;
        }
        this.setHidden(view, hiddenIn(fish.x - c.x, fish.y - c.y));
        this.plunge(v, c, t);
        // Coins: taken by touch, fading away after a while.
        v.coins = v.coins.filter(k => {
            const age = t - k.born, life = SWIRL.plunge.life;
            if (Math.hypot(k.img.x - fish.x, k.img.y - fish.y) < radius + L.coin / 2) { this.onCoin(k.img.x, k.img.y); k.img.destroy(); return false; }
            if (age > life) { k.img.destroy(); return false; }
            k.img.setAlpha(Math.min(1, (life - age) / 1.5));
            return true;
        });
    }

    /** A gannet's plunge (baitball.js plungeAt): cue, dive, under water into the ball, back up. */
    plunge(v, c, t) {
        const L = BAITBALL_LOOK, Pl = SWIRL.plunge;
        plungeAt(t, P);
        const x = c.x + P.dx, sy = this.surfaceY(x), top = c.y + plungeDepth();     // `top`: where the dive ends, inside the ball
        const view = this.scene.cameras.main.worldView;
        v.flash.setVisible(P.phase === 'cue');
        if (P.phase === 'cue') {
            // Look up! A flash on the surface, or at the top of the view when the surface is above it.
            v.flash.setPosition(x, Math.max(sy, view.y + L.flashEdge)).setDisplaySize(L.flash * (0.6 + 0.6 * P.k), L.flash * 0.45)
                .setAlpha(Math.sin(P.k * Math.PI) * 0.9);
        }
        const y0 = sy - Pl.sky, air = P.phase === 'air', under = P.phase === 'water';
        const by = air ? y0 + (sy - y0) * P.k * P.k : under ? sy + (top - sy) * (1 - (1 - P.k) ** 2) : 0;
        v.gannet?.setVisible(air || under);
        if (air || under) v.gannet?.setPosition(x, by).setRotation(0.12);
        v.jet.setVisible(under);
        if (under) {
            v.jet.setPosition(x, by - 20).setDisplaySize(L.jetWidth, Math.max(1, by - sy)).setAlpha(0.55 * (1 - P.k * 0.4));
            this.scene.particles?.spawn('bubble', x, by - 30, 1, { radius: 9, spread: 14 });
            if (v.splashed !== P.n) { v.splashed = P.n; this.splash(x); }
        }
        if (P.since >= 0 && v.hit !== P.n) {
            // It hits the ball: the sardines scatter, and coins hang in its bubble trail.
            v.hit = P.n;
            v.puff = { x, y: top, t };
            for (const p of plungeCoins(P, sy - c.y)) {
                const img = this.scene.textures.exists('coin')
                    ? this.scene.add.image(c.x + p.x, c.y + p.y, 'coin').setDisplaySize(L.coin, L.coin)
                    : this.scene.add.circle(c.x + p.x, c.y + p.y, L.coin / 2, 0xffd23f);
                v.coins.push({ img: img.setDepth(2.5), born: t });
            }
        }
        const up = P.phase === 'rise';
        v.rising?.setVisible(up);
        if (up) v.rising?.setPosition(x + Math.sin(P.k * 6) * 10, top + (sy - top) * (1 - (1 - P.k) ** 2)).setAlpha(Math.min(1, (1 - P.k) * 4));
    }

    setHidden(view, on) {
        if (on === this.hidden) return;
        this.hidden = on;
        view?.setAlpha?.(on ? BAITBALL_LOOK.hiddenAlpha : 1);
    }

}
