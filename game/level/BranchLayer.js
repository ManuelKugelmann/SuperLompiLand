import { BRANCH } from './branches.js';

export const BRANCH_LOOK = {
    murk: 0.5,           // how dark the water is at the mouth ...
    murkInside: 0.34,    // ... and along the tunnel
    murkSize: 760,       // px across of one patch of murk
    rope: 460,           // px the rope across the mouth spans
    siltMs: 260,         // one puff of silt at the mouth this often while the fish is near
    near: 2200,          // px from the mouth within which the silt runs
    clam: 300,           // px across of the giant clam
    openAt: 210,         // px: it opens when the fish comes this close ...
    takeAt: 120,         // ... and gives its pearl at this distance
    pearl: 54            // px across of the pearl
};

const KEYS = { rope: 'cave_rope', clam: 'giant_clam', clamOpen: 'giant_clam_open', pearl: 'cave_pearl', murk: 'cave_murk' };

/** The cave's pictures (fallback art, painted once; painted files under the same keys replace clam and rope). */
function ensureTextures(scene) {
    const T = scene.textures;
    if (!T.exists(KEYS.rope)) {
        // An old rope sagging across the mouth, a red-and-white fishing float on it: "someone marked this place".
        const W = 512, H = 150, tex = T.createCanvas(KEYS.rope, W, H), c = tex.getContext();
        const sag = x => 18 + 70 * Math.sin(Math.PI * x / W);
        c.lineCap = 'round';
        for (const [w, col] of [[11, '#5d4a31'], [7, '#a58a5c']]) {
            c.strokeStyle = col; c.lineWidth = w; c.beginPath();
            for (let x = 6; x <= W - 6; x += 8) { const y = sag(x); if (x === 6) c.moveTo(x, y); else c.lineTo(x, y); }
            c.stroke();
        }
        c.strokeStyle = 'rgba(70,52,30,0.7)'; c.lineWidth = 2;                      // the twist of the strands
        for (let x = 10; x < W - 10; x += 12) { const y = sag(x); c.beginPath(); c.moveTo(x - 3, y - 4); c.lineTo(x + 3, y + 4); c.stroke(); }
        const fx = W * 0.56, fy = sag(fx) + 4;
        const body = (y0, y1, a, b) => { const g = c.createLinearGradient(fx - 26, 0, fx + 26, 0); g.addColorStop(0, a); g.addColorStop(0.45, b); g.addColorStop(1, a); c.fillStyle = g; c.beginPath(); c.ellipse(fx, (y0 + y1) / 2, 26, (y1 - y0) / 2 + 10, 0, 0, 7); c.save(); c.clip(); c.fillRect(fx - 30, y0, 60, y1 - y0); c.restore(); };
        body(fy - 2, fy + 30, '#a82a22', '#ef5a4a');       // red half
        body(fy + 30, fy + 60, '#c9c2b2', '#fbf7ec');      // white half
        c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.ellipse(fx - 9, fy + 18, 5, 12, 0.2, 0, 7); c.fill();
        tex.refresh();
    }
    if (!T.exists(KEYS.murk)) {
        const tex = T.createCanvas(KEYS.murk, 128, 128), c = tex.getContext(), g = c.createRadialGradient(64, 64, 6, 64, 64, 64);
        g.addColorStop(0, 'rgba(8,22,18,1)'); g.addColorStop(0.6, 'rgba(8,22,18,0.55)'); g.addColorStop(1, 'rgba(8,22,18,0)');
        c.fillStyle = g; c.fillRect(0, 0, 128, 128);
        tex.refresh();
    }
    const clam = (key, gape) => {
        if (T.exists(key)) return;
        const W = 300, H = 240, tex = T.createCanvas(key, W, H), c = tex.getContext();
        const shell = (flip, lift) => {
            c.save(); c.translate(W / 2, H * 0.62); c.scale(1, flip); c.translate(0, -lift);
            const g = c.createLinearGradient(0, -110, 0, 30);
            g.addColorStop(0, '#f1dfe9'); g.addColorStop(0.5, '#c79ac4'); g.addColorStop(1, '#7c5a94');
            c.fillStyle = g; c.beginPath(); c.moveTo(-135, 10);
            for (let i = 0; i <= 8; i++) { const a = Math.PI * (1 - i / 8), r = 135 * (1 + 0.07 * (i % 2 ? 1 : -1)); c.lineTo(Math.cos(a) * r, -Math.sin(a) * 105 * (1 + 0.1 * (i % 2 ? 1 : -1))); }
            c.lineTo(135, 10); c.quadraticCurveTo(0, 40, -135, 10); c.fill();
            c.strokeStyle = 'rgba(90,60,110,0.55)'; c.lineWidth = 4;                 // the flutes of the shell
            for (let i = 1; i < 8; i++) { const a = Math.PI * (1 - i / 8); c.beginPath(); c.moveTo(Math.cos(a) * 30, 12); c.lineTo(Math.cos(a) * 128, -Math.sin(a) * 98); c.stroke(); }
            c.restore();
        };
        shell(-0.55, 0);                                   // lower shell, lying on the floor
        if (gape > 0) {                                    // the mantle shows when it is open
            const m = c.createLinearGradient(0, H * 0.4, 0, H * 0.66);
            m.addColorStop(0, '#2fb7c9'); m.addColorStop(1, '#1a6f9a');
            c.fillStyle = m; c.beginPath(); c.ellipse(W / 2, H * 0.6, 118, 22 + gape * 0.25, 0, 0, 7); c.fill();
        }
        shell(1, gape);                                    // upper shell, lifted when open
        tex.refresh();
    };
    clam(KEYS.clam, 0);
    clam(KEYS.clamOpen, 62);
    if (!T.exists(KEYS.pearl)) {
        const tex = T.createCanvas(KEYS.pearl, 64, 64), c = tex.getContext(), g = c.createRadialGradient(24, 22, 2, 32, 32, 30);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#f4e6f2'); g.addColorStop(1, '#b9a3c9');
        c.fillStyle = g; c.beginPath(); c.arc(32, 32, 29, 0, 7); c.fill();
        tex.refresh();
    }
}

/**
 * What the side cave looks like (level/branches.js says where it is): murky water and a
 * rope with an old float across its mouth, so it reads as "a place off the way" without any
 * sign; drifting silt; and the giant clam at the far end, which opens when you swim up and
 * gives its pearl once. `onPearl()` is called when the pearl is taken.
 */
export default class BranchLayer {
    /** `cave` = level.field.cave; `taken` = the pearl was already taken in this save. */
    constructor(scene, cave, taken, onPearl) {
        this.scene = scene; this.cave = cave; this.onPearl = onPearl; this.taken = taken; this.open = taken;
        ensureTextures(scene);
        const L = BRANCH_LOOK, murk = (x, y, a, s = 1) => scene.add.image(x, y, KEYS.murk).setDisplaySize(L.murkSize * s, L.murkSize * s).setAlpha(a).setDepth(5.6);
        murk(cave.x0, cave.top + 60, L.murk);
        murk(cave.x1, cave.top + 60, L.murk * 0.8);
        for (let x = cave.x0 + 250; x < cave.x1; x += 420) murk(x, cave.y, L.murkInside, 0.9);
        const rope = scene.add.image(cave.x0, cave.top - 70, KEYS.rope).setOrigin(0.5, 0).setDepth(3);
        rope.setScale(L.rope / rope.width);
        this.clam = scene.add.image(cave.clam.x, cave.clam.y, taken ? KEYS.clamOpen : KEYS.clam).setOrigin(0.5, 0.78).setDepth(3.1);
        this.clam.setScale(L.clam / this.clam.width);
        this.glow = scene.add.image(cave.clam.x, cave.clam.y - 70, 'bd_glow').setDisplaySize(340, 340).setTint(0xfff1c9).setBlendMode('ADD').setDepth(3.2).setAlpha(taken ? 0 : 0.25);
        this.pearl = scene.add.image(cave.clam.x, cave.clam.y - 62, KEYS.pearl).setDisplaySize(L.pearl, L.pearl).setDepth(3.3).setVisible(false);
        this.silt = 0;
    }

    /** Per frame. `fish` = { x, y }, `t` s, `delta` ms, `particles` = the scene's particle layer. */
    update(fish, t, delta, particles) {
        const c = this.cave, L = BRANCH_LOOK;
        if (Math.abs(fish.x - c.x0) < L.near && (this.silt -= delta) <= 0) {
            this.silt = L.siltMs;
            particles.spawn('silt', c.x0 + Math.sin(t * 3.1) * BRANCH.mouth * 0.8, c.top + 40, 2, { radius: 30, spread: 30, vy: 20 });
        }
        if (this.taken) return;
        const d = Math.hypot(fish.x - c.clam.x, fish.y - (c.clam.y - 60));
        this.glow.setAlpha(0.22 + 0.1 * Math.sin(t * 2.2) + (this.open ? 0.25 : 0));
        if (!this.open && d < L.openAt) {
            // It opens: the upper shell lifts and the pearl shows.
            this.open = true;
            this.clam.setTexture(KEYS.clamOpen);
            this.pearl.setVisible(true).setScale(0.2);
            this.scene.tweens.add({ targets: this.pearl, scale: L.pearl / this.pearl.width, duration: 320, ease: 'Back.easeOut' });
        }
        if (this.open && d < L.takeAt) {
            this.taken = true;
            this.scene.tweens.add({ targets: this.pearl, y: this.pearl.y - 150, alpha: 0, scale: this.pearl.scale * 1.6, duration: 700, onComplete: () => this.pearl.setVisible(false) });
            this.scene.tweens.add({ targets: this.glow, alpha: 0, duration: 900 });
            this.onPearl(c.clam.x, c.clam.y - 60);
        }
    }
}
