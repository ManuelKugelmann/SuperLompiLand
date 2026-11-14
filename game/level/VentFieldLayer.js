import { VENT_FIELD, ventSpot, chimneyAt, chimneyHeight, ventLift, ventCoins } from './ventField.js';

/**
 * What the vent field looks like (level/ventField.js says where and how it lifts): black smoker
 * chimneys on the deep seabed with a warm glow at each mouth, tube worms round their feet, smoke
 * puffing up, coins hanging in each warm column. Built only while the fish is near.
 *
 *   create():  this.ventField = new VentFieldLayer(scene, groundY, routeY, onCoin, onSeen)
 *   update():  this.ventField.update(fish, t, delta)
 *   waterAt(): this.ventField.flowAt(x, y, out)   the warm lift (px/step)
 */
export const VENT_LOOK = {
    near: 3500, far: 5500,   // px from the field at which it is built, and beyond which it is removed
    depth: 1.6,              // chimneys stand just behind the fish
    wormDepth: 1.7,
    glowDepth: 41,           // the mouths' glow is a light of its own, above the deep's darkness (MainScene ambient, 40)
    glow: 440,               // px across a mouth's glow
    coin: 64
};

// Texture keys: painted pictures loaded under these keys replace the drawn ones.
const CHIMNEY = 'vent_chimney', WORM = 'tube_worms', GLOW = 'vent_glow';

/** The painted chimney and tube worms (loaded by the title screen); drawn procedurally while missing. */
export const VENT_ART = { [CHIMNEY]: 'img/vent_chimney.webp', [WORM]: 'img/tube_worms.webp' };

function ensureTextures(scene) {
    const tex = scene.textures;
    if (!tex.exists(CHIMNEY)) {
        // A knobbly basalt chimney, wider at the foot, with mineral crusts and a warm crack at the mouth.
        const W = 128, H = 512, t = tex.createCanvas(CHIMNEY, W, H), c = t.getContext();
        const body = c.createLinearGradient(0, 0, W, 0);
        body.addColorStop(0, '#16161c'); body.addColorStop(0.45, '#3a3a44'); body.addColorStop(1, '#101014');
        c.fillStyle = body;
        c.beginPath(); c.moveTo(W * 0.36, 8);
        for (let y = 8; y <= H; y += 32) c.lineTo(W * (0.36 - 0.3 * (y / H)) + Math.sin(y * 0.09) * 6, y);
        for (let y = H; y >= 8; y -= 32) c.lineTo(W * (0.64 + 0.3 * (y / H)) + Math.sin(y * 0.11 + 1) * 6, y);
        c.closePath(); c.fill();
        c.fillStyle = 'rgba(200,170,120,0.18)';             // mineral crusts
        for (let i = 0; i < 26; i++) { const y = 30 + i * 18, x = W / 2 + Math.sin(i * 2.3) * W * 0.18 * (y / H + 0.4); c.beginPath(); c.ellipse(x, y, 7 + (i % 3) * 3, 4, 0, 0, 7); c.fill(); }
        const mouth = c.createRadialGradient(W / 2, 10, 2, W / 2, 10, 26);
        mouth.addColorStop(0, 'rgba(255,190,90,1)'); mouth.addColorStop(1, 'rgba(255,120,40,0)');
        c.fillStyle = mouth; c.fillRect(0, 0, W, 40);
        t.refresh();
    }
    if (!tex.exists(WORM)) {
        // Giant tube worms: white tubes with red plumes, a small cluster.
        const W = 160, H = 128, t = tex.createCanvas(WORM, W, H), c = t.getContext();
        for (let i = 0; i < 9; i++) {
            const x = 14 + i * 16 + Math.sin(i * 3.1) * 4, top = 18 + (i * 37 % 50);
            c.strokeStyle = '#ece6d6'; c.lineWidth = 9; c.lineCap = 'round';
            c.beginPath(); c.moveTo(x, H); c.quadraticCurveTo(x + Math.sin(i) * 8, (H + top) / 2, x + Math.sin(i * 2) * 5, top); c.stroke();
            c.fillStyle = '#e0303a'; c.beginPath(); c.ellipse(x + Math.sin(i * 2) * 5, top - 7, 7, 11, 0, 0, 7); c.fill();
        }
        t.refresh();
    }
    if (!tex.exists(GLOW)) {
        const S = 128, t = tex.createCanvas(GLOW, S, S), c = t.getContext(), g = c.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
        g.addColorStop(0, 'rgba(255,200,120,0.9)'); g.addColorStop(0.4, 'rgba(255,140,60,0.35)'); g.addColorStop(1, 'rgba(255,100,40,0)');
        c.fillStyle = g; c.fillRect(0, 0, S, S); t.refresh();
    }
}

export default class VentFieldLayer {
    constructor(scene, groundY, routeY, onCoin, onSeen) {
        this.scene = scene; this.groundY = groundY; this.routeY = routeY; this.onCoin = onCoin; this.onSeen = onSeen;
        this.spot = ventSpot();
        this.mouths = [];
        this.seen = false;
        this.taken = new Set();      // coins taken stay gone for the run
        this.puffAt = 0;
        ensureTextures(scene);
        this.live = null;
    }

    build() {
        const s = this.scene, L = VENT_LOOK, items = [], coins = [];
        this.mouths = [];
        for (let i = 0; i < VENT_FIELD.chimneys; i++) {
            const c = chimneyAt(i), ground = this.groundY(c.x);
            if (ground === null) continue;
            const route = this.routeY(c.x), h = chimneyHeight(c, ground, route);
            if (h < 120) continue;
            const img = s.add.image(c.x, ground + 20, CHIMNEY).setOrigin(0.5, 1).setDepth(L.depth);
            img.setDisplaySize(c.width, h + 20);
            const mouth = { x: c.x, y: ground - h + 8, phase: c.phase };
            const glow = s.add.image(mouth.x, mouth.y, GLOW).setDepth(L.glowDepth).setBlendMode('ADD').setDisplaySize(L.glow, L.glow);
            const worms = [];
            for (let k = 0; k < 2; k++) {
                const w = s.add.image(c.x + (k ? 1 : -1) * c.width * 0.55, ground + 8, WORM).setOrigin(0.5, 1).setDepth(L.wormDepth).setFlipX(!!k);
                w.setScale((0.45 + 0.05 * c.worms) * (k ? 0.8 : 1));
                worms.push(w);
            }
            ventCoins(mouth, route).forEach((p, k) => {
                const id = `${i}:${k}`;
                if (this.taken.has(id)) return;
                const img2 = s.textures.exists('coin') ? s.add.image(p.x, p.y, 'coin').setDisplaySize(L.coin, L.coin) : s.add.circle(p.x, p.y, L.coin / 2, 0xffd23f);
                coins.push({ img: img2.setDepth(2.5), id, x: p.x, y: p.y });
            });
            this.mouths.push(mouth);
            items.push(img, glow, ...worms);
            mouth.glow = glow;
        }
        return { items, coins };
    }

    /** Per frame. `fish` = { x, y, radius }, `t` s, `delta` ms. */
    update(fish, t, delta) {
        const L = VENT_LOOK, sp = this.spot;
        if (this.live && (fish.x < sp.x0 - L.far || fish.x > sp.x1 + L.far)) this.clear();
        if (!this.live) {
            if (fish.x < sp.x0 - L.near || fish.x > sp.x1 + L.near || !this.scene.buildSlot()) return;
            this.live = this.build();
        }
        for (const m of this.mouths) m.glow.setAlpha(0.75 + 0.25 * Math.sin(t * 1.7 + m.phase));
        // Smoke puffs from the mouths in view; the shared particles carry it up with the water.
        this.puffAt -= delta;
        if (this.puffAt <= 0) {
            this.puffAt = VENT_FIELD.plumeMs;
            const cam = this.scene.cameras.main;
            for (const m of this.mouths) {
                if (m.x < cam.scrollX - 300 || m.x > cam.scrollX + cam.width + 300) continue;
                this.scene.particles.spawn('smoker', m.x, m.y - 10, 3, { radius: 14, spread: 14, vy: -110 });
                this.scene.particles.spawn('steam', m.x, m.y - 6, 2, { radius: 10, spread: 20, vy: -140 });
            }
        }
        const r = (fish.radius || 40) + L.coin / 2;
        this.live.coins = this.live.coins.filter(c => {
            if (Math.hypot(c.x - fish.x, c.y - fish.y) > r) return true;
            this.taken.add(c.id); c.img.destroy(); this.onCoin(c.x, c.y);
            return false;
        });
        if (!this.seen && this.mouths.some(m => Math.hypot(m.x - fish.x, m.y - fish.y) < VENT_FIELD.seen)) { this.seen = true; this.onSeen('vent_field'); }
    }

    /** The warm lift at (x, y) into out (px/step); none while the field is not built. */
    flowAt(x, y, out) {
        out.x = 0; out.y = 0;
        if (!this.live || x < this.spot.x0 - 200 || x > this.spot.x1 + 200) return out;
        return ventLift(x, y, this.mouths, this.routeY(x), out);
    }

    clear() {
        for (const o of this.live.items) o.destroy();
        for (const c of this.live.coins) c.img.destroy();
        this.live = null; this.mouths = [];
    }
}
