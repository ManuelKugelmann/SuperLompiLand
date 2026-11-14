import { BRANCH } from './branches.js';

export const BRANCH_LOOK = {
    murk: 0.5,           // how dark the water is at the mouth ...
    murkInside: 0.34,    // ... and along the tunnel
    murkSize: 760,       // px across of one patch of murk
    rope: 620,           // px the rope across the mouth spans (its floats are then about 100 and 70 px across)
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
        // Old fishing gear across the mouth: a rope sagging between the rocks, two red-and-white
        // floats on it, a frayed end hanging down. "Someone marked this place", read from the route.
        const W = 512, H = 300, tex = T.createCanvas(KEYS.rope, W, H), c = tex.getContext();
        const sag = x => 24 + 86 * Math.sin(Math.PI * x / W);
        const strand = (pts, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); };
        const main = []; for (let x = 6; x <= W - 6; x += 8) main.push([x, sag(x)]);
        const loose = []; for (let k = 0; k <= 10; k++) loose.push([W * 0.27 + Math.sin(k * 0.7) * 9, sag(W * 0.27) + k * 15]);     // the hanging end
        for (const pts of [main, loose]) { strand(pts, 14, '#5d4a31'); strand(pts, 9, '#a58a5c'); }
        c.strokeStyle = 'rgba(70,52,30,0.7)'; c.lineWidth = 2.5;                    // the twist of the strands
        for (let x = 10; x < W - 10; x += 12) { const y = sag(x); c.beginPath(); c.moveTo(x - 4, y - 5); c.lineTo(x + 4, y + 5); c.stroke(); }
        const [ex, ey] = loose[loose.length - 1];                                   // frayed
        c.strokeStyle = '#a58a5c'; c.lineWidth = 3;
        for (let k = -3; k <= 3; k++) { c.beginPath(); c.moveTo(ex, ey); c.lineTo(ex + k * 7, ey + 26 + Math.abs(k) * -3); c.stroke(); }
        const float = (fx, r) => {
            const fy = sag(fx) + 6;
            c.strokeStyle = '#5d4a31'; c.lineWidth = 5; c.beginPath(); c.moveTo(fx, sag(fx)); c.lineTo(fx, fy + 8); c.stroke();
            const half = (y0, y1, a, b) => {
                c.save(); c.beginPath(); c.ellipse(fx, fy + r * 1.25, r, r * 1.25, 0, 0, 7); c.clip();
                const g = c.createLinearGradient(fx - r, 0, fx + r, 0); g.addColorStop(0, a); g.addColorStop(0.42, b); g.addColorStop(1, a);
                c.fillStyle = g; c.fillRect(fx - r, y0, r * 2, y1 - y0); c.restore();
            };
            half(fy, fy + r * 1.25, '#a82a22', '#f0604f');                          // red on top
            half(fy + r * 1.25, fy + r * 2.5, '#c2bbab', '#fbf7ec');                // white below
            c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(fx - r * 0.35, fy + r * 0.8, r * 0.16, r * 0.42, 0.2, 0, 7); c.fill();
        };
        float(W * 0.58, 44);
        float(W * 0.8, 30);
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
