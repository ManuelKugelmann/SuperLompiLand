import { MEADOW, meadowSpot, eelAt, eelOut, createRay, stepRay } from './meadow.js';

export const MEADOW_LOOK = {
    near: 3200, far: 5000,   // px from the colony at which it is built, and beyond which it is removed
    eelWidth: 26,        // px across of an eel's body as drawn
    depth: 0.95,         // on the sand, just over the ground cover
    rayDepth: 1.2,
    rayFlap: 0.1         // how much the ray's wings beat while it glides (share of its height)
};

// Texture keys: painted pictures loaded under these keys replace the drawn ones.
const EEL = 'garden_eel', RAY = 'sand_ray';

function ensureTextures(scene) {
    if (!scene.textures.exists(EEL)) {
        // A garden eel: a slim pale body with dark spots, a small head with an eye, standing upright.
        const W = 32, H = 256, tex = scene.textures.createCanvas(EEL, W, H), c = tex.getContext();
        c.lineCap = 'round'; c.strokeStyle = '#e9e2c8'; c.lineWidth = 15;
        c.beginPath(); c.moveTo(W / 2, H - 6); c.bezierCurveTo(W / 2 - 5, H * 0.66, W / 2 + 6, H * 0.36, W / 2, 20); c.stroke();
        c.fillStyle = '#3d3a34';
        for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(W / 2 + (i % 2 ? 3 : -3), 44 + i * 22, 3.2, 0, 7); c.fill(); }
        c.fillStyle = '#e9e2c8'; c.beginPath(); c.ellipse(W / 2 + 2, 16, 9, 11, 0, 0, 7); c.fill();
        c.fillStyle = '#1b2c5c'; c.beginPath(); c.arc(W / 2 + 5, 14, 3, 0, 7); c.fill();
        tex.refresh();
    }
    if (!scene.textures.exists(RAY)) {
        // A ray seen from the side and a little above: a flat sand-coloured diamond with spots and a thin tail.
        const W = 256, H = 96, tex = scene.textures.createCanvas(RAY, W, H), c = tex.getContext();
        c.strokeStyle = '#a58e63'; c.lineWidth = 5; c.lineCap = 'round';
        c.beginPath(); c.moveTo(60, H * 0.58); c.quadraticCurveTo(26, H * 0.5, 6, H * 0.62); c.stroke();
        const g = c.createLinearGradient(0, 10, 0, H);
        g.addColorStop(0, '#d9c494'); g.addColorStop(1, '#a58e63');
        c.fillStyle = g; c.beginPath(); c.moveTo(50, H * 0.6); c.quadraticCurveTo(120, 4, 232, H * 0.5); c.quadraticCurveTo(250, H * 0.6, 232, H * 0.68); c.quadraticCurveTo(130, H, 50, H * 0.6); c.fill();
        c.fillStyle = 'rgba(120,96,58,0.6)';
        for (const [x, y, r] of [[110, 40, 6], [140, 56, 5], [170, 38, 6], [190, 58, 4], [128, 70, 4]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
        c.fillStyle = '#1b2c5c'; c.beginPath(); c.arc(214, H * 0.47, 4, 0, 7); c.fill();
        tex.refresh();
    }
}

/**
 * What the eel meadow looks like (level/meadow.js says where it is and how its animals behave):
 * the eels as upright pictures that sink into the sand, and the ray. Built only while the fish
 * is near. `groundY(x)` = the seabed under the calm route at x (or null); `onSeen(kind)` is
 * called once each for 'garden_eel' and 'sand_ray'.
 */
export default class MeadowLayer {
    constructor(scene, groundY, onSeen) {
        this.scene = scene; this.groundY = groundY; this.onSeen = onSeen;
        this.spot = meadowSpot();
        this.seen = { eel: false, ray: false };
        ensureTextures(scene);
        this.live = null;      // { eels: [{ img, x, y, height, phase, out }], ray: { img, mind } }
    }

    build() {
        const s = this.scene, L = MEADOW_LOOK, eels = [];
        for (let i = 0; i < MEADOW.eels; i++) {
            const e = eelAt(i), y = this.groundY(e.x);
            if (y === null) continue;
            const img = s.add.image(e.x, y + 6, EEL).setOrigin(0.5, 1).setDepth(L.depth);
            img.setScale(L.eelWidth / img.width, e.height / img.height);
            eels.push({ img, x: e.x, y, height: e.height, phase: e.phase, out: 1, full: e.height / img.height });
        }
        const mind = createRay(this.spot.x + MEADOW.ray.from), ry = this.groundY(mind.x);
        const img = s.add.image(mind.x, ry ?? 0, RAY).setOrigin(0.5, 0.75).setDepth(L.rayDepth).setVisible(ry !== null);
        img.setScale(MEADOW.ray.width / img.width);
        return { eels, ray: { img, mind, ground: ry, scale: img.scaleY } };
    }

    /** Per frame. `fish` = { x, y }, `t` s, `delta` ms. */
    update(fish, t, delta) {
        const L = MEADOW_LOOK, sp = this.spot, dt = delta / 1000;
        if (this.live && (fish.x < sp.x0 - L.far || fish.x > sp.x1 + L.far)) { for (const e of this.live.eels) e.img.destroy(); this.live.ray.img.destroy(); this.live = null; }
        if (!this.live) {
            if (fish.x < sp.x0 - L.near || fish.x > sp.x1 + L.near || !this.scene.buildSlot()) return;
            this.live = this.build();
        }
        for (const e of this.live.eels) {
            const d = Math.hypot(fish.x - e.x, fish.y - (e.y - e.height * 0.5));
            e.out = eelOut(e.out, d, dt);
            e.img.setVisible(e.out > 0.02).setScale(e.img.scaleX, e.full * e.out).setRotation(Math.sin(t * 1.3 + e.phase) * MEADOW.sway * e.out);
            if (!this.seen.eel && d < MEADOW.seen) { this.seen.eel = true; this.onSeen('garden_eel'); }
        }
        const r = this.live.ray;
        if (r.ground === null) return;
        const lift = stepRay(r.mind, Math.hypot(fish.x - r.mind.x, fish.y - r.ground), fish.x - r.mind.x, dt, sp.x0 - 600, sp.x1 + 600);
        const ground = this.groundY(r.mind.x) ?? r.ground;
        r.ground = ground;
        // At rest it lies flat on the sand; in its glide it tips up a little and its wings beat.
        r.img.setPosition(r.mind.x, ground - lift).setFlipX(r.mind.dir < 0)
            .setScale(r.img.scaleX, r.scale * (1 + (lift > 0 ? Math.sin(t * 7) * L.rayFlap : 0)));
        if (!this.seen.ray && lift > 0) { this.seen.ray = true; this.onSeen('sand_ray'); }
    }
}
