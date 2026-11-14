import { OCTOPUS, createOctopus, stepOctopus } from './octopus.js';

/**
 * What the octopus looks like (ai/octopus.js says how it behaves): a picture on the sand that melts
 * into the ground's colour when it hides, flushes bright when curious, squirts ink and jets away
 * when startled, and leaves coins for a calm visitor. Built only near the fish.
 * `groundY(x)` = the seabed under the calm route; `onCoin(x, y)`, `onSeen(kind)`.
 */
export const OCTOPUS_LOOK = {
    near: 2600, far: 4200,
    size: 230,           // px across as drawn
    depth: 1.9,
    sand: 0xc9b48a,      // the colour it melts into
    hidden: 0.45,        // alpha when fully camouflaged
    coin: 64
};

const KEY = 'octopus';

/** The painted octopus (loaded by the title screen); drawn procedurally while missing. */
export const OCTOPUS_ART = { [KEY]: 'img/octopus.webp' };

function ensureTexture(scene) {
    if (scene.textures.exists(KEY)) return;
    // A common octopus on the sand, side view: a round mantle, big eye, eight curling arms.
    const W = 256, H = 192, t = scene.textures.createCanvas(KEY, W, H), c = t.getContext();
    c.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
        const x0 = 70 + i * 16, sway = (i % 2 ? 1 : -1) * (14 + i * 2);
        c.strokeStyle = '#d0603e'; c.lineWidth = 16 - i * 0.6;
        c.beginPath(); c.moveTo(x0, 110); c.quadraticCurveTo(x0 + sway, 160, x0 + sway * 1.8, 180 - (i % 3) * 6); c.stroke();
        c.strokeStyle = '#f2b49a'; c.lineWidth = 3;
        for (let k = 0; k < 4; k++) { c.beginPath(); c.arc(x0 + sway * (0.4 + k * 0.35), 132 + k * 11, 2.4, 0, 7); c.stroke(); }
    }
    const g = c.createRadialGradient(118, 64, 10, 128, 80, 80); g.addColorStop(0, '#f08a5c'); g.addColorStop(1, '#b9472c');
    c.fillStyle = g; c.beginPath(); c.ellipse(128, 76, 66, 58, -0.25, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,220,190,0.35)'; for (const [x, y, r] of [[100, 50, 7], [130, 40, 5], [150, 66, 6], [112, 80, 4]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
    c.fillStyle = '#fff6d8'; c.beginPath(); c.ellipse(172, 100, 15, 12, 0, 0, 7); c.fill();
    c.fillStyle = '#1b2236'; c.beginPath(); c.ellipse(175, 101, 7, 9, 0, 0, 7); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(178, 97, 2.6, 0, 7); c.fill();
    t.refresh();
}

const mix = (a, b, k) => {
    const ch = s => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * k);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

export default class OctopusLayer {
    constructor(scene, groundY, onCoin, onSeen) {
        this.scene = scene; this.groundY = groundY; this.onCoin = onCoin; this.onSeen = onSeen;
        this.mind = createOctopus(OCTOPUS.x);
        this.seen = false;
        ensureTexture(scene);
        this.live = null;
    }

    update(fish, speed, t, delta) {
        const L = OCTOPUS_LOOK, o = this.mind, dt = delta / 1000;
        if (this.live && Math.abs(fish.x - o.home) > L.far) { this.live.img.destroy(); for (const c of this.live.coins) c.img.destroy(); this.live = null; }
        if (!this.live) {
            if (Math.abs(fish.x - o.home) > L.near || !this.scene.buildSlot()) return;
            const img = this.scene.add.image(o.x, 0, KEY).setOrigin(0.5, 0.92).setDepth(L.depth);
            img.setScale(L.size / img.width);
            this.live = { img, coins: [], scale: img.scaleX };
        }
        const v = this.live, ground = this.groundY(o.x);
        if (ground === null) { v.img.setVisible(false); return; }
        const dist = Math.hypot(fish.x - o.x, fish.y - (ground - 60));
        const ev = stepOctopus(o, dt, dist < OCTOPUS.shy * 1.5 ? { dx: fish.x - o.x, dist, speed } : null);
        if (ev === 'ink') {
            this.scene.particles.spawn('ink', o.x, ground - 70, 10, { radius: 40, spread: 60 });
        } else if (ev === 'friend') {
            for (let k = 0; k < OCTOPUS.gift; k++) {
                const x = o.x + (k - 1) * 90, y = ground - 220 - (k % 2) * 50;
                const img = this.scene.textures.exists('coin') ? this.scene.add.image(x, y, 'coin').setDisplaySize(L.coin, L.coin) : this.scene.add.circle(x, y, L.coin / 2, 0xffd23f);
                v.coins.push({ img: img.setDepth(2.5), x, y });
            }
            this.scene.particles.spawn('bubble', o.x, ground - 120, 8, { radius: 50, spread: 50 });
        }
        // Camouflage: its colour runs into the sand's and it fades; curious, it flushes brighter.
        const flush = o.state === 'friend' ? 0.5 + 0.5 * Math.sin(t * 9) : 0;
        v.img.setVisible(true).setPosition(o.x, ground + 6).setFlipX(o.state === 'jet' ? o.to < o.from : o.dir < 0)
            .setTint(mix(0xffffff, L.sand, o.camo * 0.85)).setAlpha(1 - (1 - L.hidden) * o.camo)
            .setScale(v.scale * (1 + flush * 0.06), v.scale * (1 - flush * 0.04) * (o.state === 'jet' ? 0.8 : 1))
            .setRotation(o.state === 'friend' ? Math.sin(t * 4) * 0.08 : 0);
        const r = 60;
        v.coins = v.coins.filter(c => {
            if (Math.hypot(c.x - fish.x, c.y - fish.y) > r) return true;
            c.img.destroy(); this.onCoin(c.x, c.y); return false;
        });
        if (!this.seen && dist < 900) { this.seen = true; this.onSeen('octopus'); }
    }
}
