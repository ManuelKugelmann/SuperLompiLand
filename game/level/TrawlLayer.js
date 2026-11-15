import Phaser from 'phaser';
import { TRAWL, trawlSpot, headY, createTrawl, stepTrawl, holdAt } from './trawl.js';

/** How the trawl looks: a net baked once (mesh, floats on the headrope, bobbins on the footrope, an otter board), the boat at the surface, the warp. */
export const TRAWL_LOOK = {
    depth: 3.2,          // set pieces in the play plane (depths.js): it sweeps in front of the ground, behind the swimmers
    boatDepth: 4.6,      // the boat stands through the surface: behind the surface line
    net: [1600, 600],    // px of the baked net picture (mouth at the right, cod end at the left)
    boat: [900, 300],    // px of the boat picture; its waterline at `boatLine` of its height
    boatLine: 0.58,
    warpTint: 0x2a3236,
    rumbleEvery: 1.6,    // s between two plays of the engine (audio.js ENGINE: each lasts longer, they cross-fade into one drone)
    hear: 3200           // px within which the engine is heard
};

const KEYS = { net: 'trawl_net', boat: 'trawl_boat', warp: 'trawl_warp' };

/** Painted pictures (loaded by the title screen; the procedural ones below stand in while missing). `line`: the painted boat's waterline, share of its height. */
export const TRAWL_ART = { net: { key: KEYS.net, file: 'img/trawl_net.webp' }, boat: { key: KEYS.boat, file: 'img/trawl_boat.webp', line: 0.81 } };

/** Procedural pictures (painted ones can come under the same keys). */
function ensureTextures(scene) {
    const t = scene.textures, [W, H] = TRAWL_LOOK.net;
    if (!t.exists(KEYS.net)) {
        const c = t.createCanvas(KEYS.net, W, H), x = c.getContext(), M = W - 110;   // M: the mouth's x
        const body = [[M, 18], [M * 0.55, H * 0.3], [150, H * 0.55], [150, H * 0.82], [M * 0.55, H - 30], [M, H - 12]];
        x.save(); x.beginPath(); body.forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py))); x.closePath();
        x.fillStyle = 'rgba(40,58,52,0.18)'; x.fill(); x.clip();
        x.strokeStyle = 'rgba(32,44,40,0.75)'; x.lineWidth = 3;
        for (let d = -H; d < W + H; d += 34) { x.beginPath(); x.moveTo(d, 0); x.lineTo(d + H, H); x.stroke(); x.beginPath(); x.moveTo(d + H, 0); x.lineTo(d, H); x.stroke(); }
        x.restore();
        // The cod end: the bag at the back, with the catch in it.
        x.fillStyle = 'rgba(30,42,38,0.8)'; x.beginPath(); x.ellipse(110, H * 0.685, 110, 70, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = 'rgba(190,200,205,0.75)';
        for (let i = 0; i < 9; i++) { x.beginPath(); x.ellipse(60 + (i % 3) * 38, H * 0.64 + Math.floor(i / 3) * 22, 16, 6, (i % 2 - 0.5) * 0.6, 0, Math.PI * 2); x.fill(); }
        // Headrope with floats, footrope with bobbins.
        x.strokeStyle = '#2b2b2b'; x.lineWidth = 7;
        x.beginPath(); x.moveTo(M, 18); x.quadraticCurveTo(M * 0.8, H * 0.08, M * 0.55, H * 0.3); x.stroke();
        x.beginPath(); x.moveTo(M, H - 12); x.lineTo(M * 0.55, H - 30); x.stroke();
        x.fillStyle = '#f08a2c';
        for (let i = 0; i < 9; i++) { const u = i / 8, px = M - u * M * 0.45, py = 18 + (H * 0.3 - 18) * u * u; x.beginPath(); x.arc(px, py - 8, 11, 0, Math.PI * 2); x.fill(); }
        x.fillStyle = '#1b1d1e';
        for (let i = 0; i < 12; i++) { const u = i / 11, px = M - u * M * 0.45, py = H - 12 - 18 * u; x.beginPath(); x.arc(px, py, 13, 0, Math.PI * 2); x.fill(); }
        // The otter board ahead of the mouth, on the seabed, with its bridles.
        x.strokeStyle = '#3a3a3a'; x.lineWidth = 3; x.beginPath(); x.moveTo(M, 18); x.lineTo(W - 40, H - 120); x.moveTo(M, H - 12); x.lineTo(W - 40, H - 60); x.stroke();
        x.fillStyle = '#4a3e33'; x.save(); x.translate(W - 45, H - 90); x.rotate(-0.25); x.fillRect(-26, -70, 52, 140); x.restore();
        c.refresh();
    }
    if (!t.exists(KEYS.boat)) {
        const [w, h] = TRAWL_LOOK.boat, c = t.createCanvas(KEYS.boat, w, h), x = c.getContext(), wl = h * TRAWL_LOOK.boatLine;
        // A fishing boat seen from the side, bow to the right: red hull, white wheelhouse, the A-frame gantry at the stern.
        x.fillStyle = '#b8332a'; x.beginPath(); x.moveTo(40, wl - 40); x.lineTo(w - 30, wl - 60); x.lineTo(w - 120, wl + 70); x.lineTo(90, wl + 70); x.closePath(); x.fill();
        x.fillStyle = '#2a2f33'; x.beginPath(); x.moveTo(70, wl + 10); x.lineTo(w - 70, wl + 10); x.lineTo(w - 120, wl + 70); x.lineTo(90, wl + 70); x.closePath(); x.fill();
        x.fillStyle = '#f2f0ea'; x.fillRect(w * 0.52, wl - 140, 190, 100); x.fillStyle = '#5c7f95'; for (let i = 0; i < 4; i++) x.fillRect(w * 0.52 + 16 + i * 44, wl - 124, 30, 26);
        x.strokeStyle = '#d9d4c8'; x.lineWidth = 12; x.beginPath(); x.moveTo(60, wl - 40); x.lineTo(110, wl - 200); x.lineTo(160, wl - 40); x.stroke();
        x.fillStyle = '#e8e2d2'; x.fillRect(w * 0.6, wl - 220, 12, 80);
        c.refresh();
    }
    if (!t.exists(KEYS.warp)) { const c = t.createCanvas(KEYS.warp, 6, 16), x = c.getContext(); x.fillStyle = '#ffffff'; x.fillRect(1, 0, 4, 16); c.refresh(); }
}

/**
 * The trawl event (trawl.js is the rule). Nothing exists until a fish sets it off; the net, the boat and its warp
 * are made when the net comes and dropped when it has lifted away. `world` = { floor(x), route(x), surface(x) };
 * `on`: { warn(x, y), tow(), caught(x, y), released(), rumble(near 0..1) }.
 */
export default class TrawlLayer {
    constructor(scene, world, on) {
        this.scene = scene; this.world = world; this.on = on;
        this.spot = trawlSpot();
        this.s = createTrawl();
        this.parts = null; this.rumble = 0;
    }

    build() {
        const s = this.scene, L = TRAWL_LOOK;
        ensureTextures(s);
        const net = s.add.image(0, 0, KEYS.net).setOrigin(1 - 110 / L.net[0], 1).setDepth(L.depth);
        const painted = !s.textures.get(KEYS.boat).source[0].isCanvas;      // the loaded picture, not the drawn stand-in
        const boat = s.add.image(0, 0, KEYS.boat).setOrigin(0.5, painted ? TRAWL_ART.boat.line : L.boatLine).setDepth(L.boatDepth);
        const warp = s.add.rope(0, 0, KEYS.warp, null, [new Phaser.Math.Vector2(), new Phaser.Math.Vector2(), new Phaser.Math.Vector2()], false).setDepth(L.depth - 0.01).setColors(L.warpTint);
        return { net, boat, warp };
    }

    drop() { if (!this.parts) return; for (const o of Object.values(this.parts)) o.destroy(); this.parts = null; }

    /** Per frame: `fish` = the player (Player), `dt` s. Holds and lets go of the fish itself while it is carried. */
    update(fish, dt) {
        if (!this.spot) return;
        const sp = fish.sprite, w = this.world, s = stepTrawl(this.s, dt, { x: sp.x, y: sp.y, r: fish.radius }, w);
        if (s.event === 'warn') this.on.warn(sp.x - 600, sp.y);
        if (s.event === 'tow') { this.parts = this.build(); this.on.tow(); }
        if (s.event === 'caught') this.on.caught(sp.x, sp.y);
        // A catch that took the last heart starts the respawn: the net lets go at once (review: it held the fish at the net through half the respawn).
        if (this.scene.respawning && s.carry > 0) s.carry = 0;
        if (s.carry > 0) { const h = holdAt(s, w); sp.setPosition(h.x, h.y); sp.setVelocity(TRAWL.speed / 60, 0); }
        if (s.event === 'released') { const h = holdAt(s, w); sp.setPosition(h.x, h.outY); sp.setVelocity(4, -6); this.on.released(); }
        if (s.event === 'gone') this.drop();
        if ((s.phase === 'warn' || s.phase === 'tow') && (this.rumble -= dt) <= 0) {
            this.rumble = TRAWL_LOOK.rumbleEvery;
            const d = s.phase === 'warn' ? TRAWL.behind : Math.abs(s.mouthX + TRAWL.boatAhead - sp.x);      // the engine is the boat's
            if (d < TRAWL_LOOK.hear) this.on.rumble(1 - d / TRAWL_LOOK.hear);
        }
        if (this.parts) this.draw();
    }

    /** The net over the seabed under its mouth (lifting toward the surface at the end), the boat ahead, the warp between. */
    draw() {
        const { net, boat, warp } = this.parts, s = this.s, w = this.world, L = TRAWL_LOOK, mx = s.mouthX;
        const floor = w.floor(mx), top = headY(mx, w), rise = s.lift * (floor - 260);
        net.setPosition(mx, floor - rise).setDisplaySize(L.net[0], Math.max(120, floor - top) + 12).setAlpha(1 - 0.6 * s.lift);
        const bx = mx + TRAWL.boatAhead;
        boat.setPosition(bx, w.surface(bx)).setRotation(Math.sin(this.scene.time.now / 900) * 0.03);
        const stern = [bx - L.boat[0] * 0.42, w.surface(bx) + 20], p = warp.points;
        p[0].set(mx + 60, floor - rise - 80); p[1].set(stern[0], stern[1]); p[2].set(mx - 4, top - rise);
        warp.setDirty();
    }

    destroy() { this.drop(); }
}
