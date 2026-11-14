import { DOCKS, freesCrab } from './docks.js';

export const DOCKS_LOOK = {
    murk: 0.5,           // how dark and oily the water under the deck is
    murkSize: 820,       // px across of one patch of it
    rope: [70, 330],     // px width and length of a hanging rope
    sway: 0.09,          // radians the ropes swing
    cap: 150,            // px across of the bottle cap with the crab in it
    crab: 130,           // px across of the crab once it is out
    glintEvery: 2.6,     // s between the glints on the cap that catch the eye from the route
    sheen: 0.22          // alpha of the rainbow sheen that lies on the water under the deck
};

const KEYS = { murk: 'docks_murk', sheen: 'docks_sheen', rope: 'docks_rope', cap: 'hermit_cap', crab: 'hermit_crab' };

/** Painted crab pictures (loaded by the title screen); drawn procedurally while missing. */
export const DOCKS_ART = { hermit_cap: 'img/hermit_cap.png', hermit_crab: 'img/hermit_free.png' };

/** The docks' pictures (fallback art, painted once; painted files under the same keys replace rope, cap and crab). */
function ensureTextures(scene) {
    const T = scene.textures;
    if (!T.exists(KEYS.murk)) {
        // Oily murk: a dark brown haze with a faint sheen in it.
        const tex = T.createCanvas(KEYS.murk, 128, 128), c = tex.getContext(), g = c.createRadialGradient(64, 64, 6, 64, 64, 64);
        g.addColorStop(0, 'rgba(26,20,10,1)'); g.addColorStop(0.55, 'rgba(26,20,10,0.6)'); g.addColorStop(1, 'rgba(26,20,10,0)');
        c.fillStyle = g; c.fillRect(0, 0, 128, 128);
        tex.refresh();
    }
    if (!T.exists(KEYS.sheen)) {
        // An oil sheen: a thin band of soft rainbow colours, as it lies on the water.
        const W = 512, H = 48, tex = T.createCanvas(KEYS.sheen, W, H), c = tex.getContext(), g = c.createLinearGradient(0, 0, W, 0);
        ['#b06bd6', '#5b8ef0', '#5fd0b0', '#e9d85a', '#f08a5b', '#b06bd6'].forEach((col, i, a) => g.addColorStop(i / (a.length - 1), col));
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        c.globalCompositeOperation = 'destination-in';
        const v = c.createLinearGradient(0, 0, 0, H); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.5, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = v; c.fillRect(0, 0, W, H);
        tex.refresh();
    }
    if (!T.exists(KEYS.rope)) {
        // A rope hanging from the deck: twisted strands, green with growth near the top, frayed at the end.
        const W = 64, H = 320, tex = T.createCanvas(KEYS.rope, W, H), c = tex.getContext();
        c.lineCap = 'round';
        for (const [w, col] of [[15, '#4f3f2a'], [10, '#9b8257']]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(W / 2, 4); c.bezierCurveTo(W / 2 + 6, H * 0.3, W / 2 - 6, H * 0.6, W / 2 + 2, H - 40); c.stroke(); }
        c.strokeStyle = 'rgba(60,46,26,0.75)'; c.lineWidth = 2.5;
        for (let y = 10; y < H - 44; y += 11) { c.beginPath(); c.moveTo(W / 2 - 6, y); c.lineTo(W / 2 + 6, y + 7); c.stroke(); }
        c.strokeStyle = 'rgba(86,122,70,0.8)'; c.lineWidth = 4;                     // weed growing on it
        for (let i = 0; i < 6; i++) { const y = 20 + i * 22; c.beginPath(); c.moveTo(W / 2 + (i % 2 ? 6 : -6), y); c.lineTo(W / 2 + (i % 2 ? 20 : -20), y + 16); c.stroke(); }
        c.strokeStyle = '#9b8257'; c.lineWidth = 3;                                 // the frayed end
        for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(W / 2 + 2, H - 42); c.lineTo(W / 2 + 2 + k * 6, H - 8 - Math.abs(k) * 4); c.stroke(); }
        tex.refresh();
    }
    const crab = (c, x, y, s) => {
        // A small hermit crab: two eyes on stalks, two claws, a bit of body.
        c.fillStyle = '#e07a4d'; c.beginPath(); c.ellipse(x, y, 20 * s, 14 * s, 0, 0, 7); c.fill();
        for (const side of [-1, 1]) {
            c.fillStyle = '#ef8f5f'; c.beginPath(); c.ellipse(x + side * 26 * s, y + 4 * s, 12 * s, 8 * s, side * 0.5, 0, 7); c.fill();       // claw
            c.strokeStyle = '#c9623a'; c.lineWidth = 3 * s; c.beginPath(); c.moveTo(x + side * 7 * s, y - 10 * s); c.lineTo(x + side * 9 * s, y - 24 * s); c.stroke();
            c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x + side * 9 * s, y - 27 * s, 6 * s, 0, 7); c.fill();
            c.fillStyle = '#1b2c5c'; c.beginPath(); c.arc(x + side * 9 * s, y - 27 * s, 3 * s, 0, 7); c.fill();
        }
    };
    if (!T.exists(KEYS.cap)) {
        // A crown cap with the crab wedged in it, only eyes and claws showing.
        const S = 160, tex = T.createCanvas(KEYS.cap, S, S), c = tex.getContext(), m = S / 2;
        crab(c, m, m - 6, 1.25);
        const g = c.createLinearGradient(0, m - 10, 0, S - 16);
        g.addColorStop(0, '#d7dade'); g.addColorStop(0.5, '#8f969c'); g.addColorStop(1, '#5d646b');
        c.fillStyle = g; c.beginPath();
        for (let i = 0; i <= 42; i++) { const a = Math.PI * i / 42, r = 62 + (i % 2 ? 6 : 0); c.lineTo(m + Math.cos(a) * r, m + 8 + Math.sin(a) * r * 0.78); }      // the crimped rim, seen from the side
        c.closePath(); c.fill();
        c.fillStyle = 'rgba(160,90,40,0.55)'; for (const [x, y, r] of [[m - 30, m + 34, 9], [m + 22, m + 44, 7], [m + 40, m + 22, 5]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }   // rust
        tex.refresh();
    }
    if (!T.exists(KEYS.crab)) {
        const S = 128, tex = T.createCanvas(KEYS.crab, S, S), c = tex.getContext();
        crab(c, S / 2, S / 2 + 10, 1.5);
        tex.refresh();
    }
}

const MURK_DEPTH = 43;      // above the scene's light and vignette layers (40 to 42), below effects and the HUD

/**
 * What the docks look like (level/docks.js says where they are): oily murk under the pier's
 * deck, loose ropes swinging from it, and the hermit crab in its bottle cap hanging in one of
 * them. A special nearby (or a nudge) pops the cap off; the crab waves and climbs away up its
 * rope. `onFree(x, y)` is called once.
 */
export default class DocksLayer {
    /** `spot` = docksSpot(); `freed` = the crab was already freed in this save. */
    constructor(scene, spot, freed, onFree) {
        this.scene = scene; this.spot = spot; this.freed = freed; this.onFree = onFree;
        ensureTextures(scene);
        const L = DOCKS_LOOK;
        // Murk over everything under the deck (above the scene's own light and colour layers, so it shows), and a sheen on the water.
        for (let x = spot.x0 + 150; x <= spot.x1 - 100; x += 300) {
            scene.add.image(x, (spot.top + spot.bottom) / 2 + 60, KEYS.murk).setDisplaySize(L.murkSize, L.murkSize * 0.85).setAlpha(L.murk).setDepth(MURK_DEPTH);
        }
        this.sheen = scene.add.tileSprite(spot.x, 26, spot.x1 - spot.x0, 40, KEYS.sheen).setAlpha(L.sheen).setDepth(MURK_DEPTH).setBlendMode('ADD');
        this.glint = scene.add.image(spot.crab.x, spot.crab.y, 'bd_glow').setDisplaySize(260, 260).setTint(0xfff6d0).setBlendMode('ADD').setDepth(3.2).setAlpha(0);
        this.ropes = spot.ropes.map((x, i) => {
            const r = scene.add.image(x, 30, KEYS.rope).setOrigin(0.5, 0).setDisplaySize(L.rope[0], L.rope[1]).setDepth(3);
            r.phase = i * 1.9;
            return r;
        });
        this.crabRope = this.ropes.find(r => Math.abs(r.x - spot.crab.x) < 1);
        this.cap = scene.add.image(spot.crab.x, spot.crab.y, freed ? KEYS.crab : KEYS.cap).setDepth(3.1).setVisible(!freed);
        this.cap.setScale(L.cap / this.cap.width);
    }

    /** A special went off at (x, y). */
    special(x, y) {
        if (!this.freed && freesCrab(this.spot, x, y)) this.free();
    }

    free() {
        const s = this.scene, c = this.cap, L = DOCKS_LOOK;
        this.freed = true;
        // The cap pops off and sinks; the crab waves, then climbs away up the rope.
        const lid = s.add.image(c.x, c.y, KEYS.cap).setDepth(3.05).setScale(c.scale);
        s.tweens.add({ targets: lid, y: lid.y + 420, x: lid.x + 60, angle: 200, alpha: 0, duration: 1400, ease: 'Sine.easeIn', onComplete: () => lid.destroy() });
        c.setTexture(KEYS.crab).setScale(L.crab / c.width);
        s.tweens.add({ targets: c, angle: { from: -14, to: 14 }, duration: 160, yoyo: true, repeat: 5,
            onComplete: () => s.tweens.add({ targets: c, y: 40, alpha: 0, duration: 1900, ease: 'Sine.easeIn', onComplete: () => c.setVisible(false) }) });
        this.onFree(c.x, c.y);
    }

    /** Per frame. `fish` = { x, y }, `t` s. */
    update(fish, t) {
        for (const r of this.ropes) r.setRotation(Math.sin(t * 0.9 + r.phase) * DOCKS_LOOK.sway);
        this.sheen.tilePositionX = t * 14;
        if (this.freed) { this.glint.setAlpha(0); return; }
        // It hangs at the end of its rope and swings with it, wriggling.
        const r = this.crabRope, len = this.spot.crab.y - r.y;
        this.cap.setPosition(r.x - Math.sin(r.rotation) * len, r.y + Math.cos(r.rotation) * len).setRotation(r.rotation + Math.sin(t * 7) * 0.06);
        // A glint on the cap now and then: it is seen from the route below.
        const g = (t % DOCKS_LOOK.glintEvery) / 0.5;
        this.glint.setPosition(this.cap.x, this.cap.y).setAlpha(g < 1 ? 0.75 * Math.sin(g * Math.PI) : 0);
        if (freesCrab(this.spot, fish.x, fish.y, true)) this.free();
    }
}
