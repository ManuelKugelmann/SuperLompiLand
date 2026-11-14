import { GARDEN_EELS, eelSpot, eelAt, scared, stepEel } from './gardenEels.js';

/**
 * What the garden eel colony looks like (level/gardenEels.js says where and when they hide): thin
 * pale eels standing out of their holes, swaying, pulling down into the sand as Lompi passes.
 * One image per eel and one per hole, built only while Lompi is near; scaled per frame, nothing redrawn.
 *
 *   create():  this.gardenEels = new GardenEelLayer(scene, groundY, onSeen)
 *   update():  this.gardenEels.update(fish, t, dt)
 */
export const EEL_LOOK = { near: 2600, far: 4000, depth: 3.1, sway: 0.12 };

const EEL = 'garden_eel', HOLE = 'eel_hole';

/** Painted pictures loaded under these keys replace the drawn ones. */
export const EEL_ART = { [EEL]: 'img/garden_eel.webp' };

function ensureTextures(scene) {
    const tex = scene.textures, TAU = Math.PI * 2;
    if (!tex.exists(EEL)) {
        // A thin pale eel, slightly curved like a question mark at the top, with fine dark spots.
        const W = 40, H = 180, t = tex.createCanvas(EEL, W, H), c = t.getContext();
        c.strokeStyle = '#efe6cf'; c.lineWidth = 17; c.lineCap = 'round';
        c.beginPath(); c.moveTo(W / 2, H); c.bezierCurveTo(W / 2 - 4, H * 0.5, W / 2 + 6, H * 0.2, W / 2 + 10, 14); c.stroke();
        c.fillStyle = 'rgba(60,50,40,0.55)';
        for (let k = 0; k < 14; k++) { c.beginPath(); c.arc(W / 2 + Math.sin(k * 1.7) * 3 + (k < 4 ? 6 : 0), 30 + k * 10, 1.6, 0, TAU); c.fill(); }
        c.fillStyle = '#1d1d1d'; c.beginPath(); c.arc(W / 2 + 13, 12, 2.6, 0, TAU); c.fill();
        t.refresh();
    }
    if (!tex.exists(HOLE)) {
        const W = 44, H = 14, t = tex.createCanvas(HOLE, W, H), c = t.getContext(), g = c.createRadialGradient(W / 2, H / 2, 1, W / 2, H / 2, W / 2);
        g.addColorStop(0, 'rgba(40,30,20,0.85)'); g.addColorStop(1, 'rgba(120,100,70,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(W / 2, H / 2, W / 2, H / 2, 0, 0, TAU); c.fill(); t.refresh();
    }
}

export default class GardenEelLayer {
    constructor(scene, groundY, onSeen) {
        this.scene = scene; this.groundY = groundY; this.onSeen = onSeen;
        this.spot = eelSpot();
        this.eels = Array.from({ length: GARDEN_EELS.count }, (_, i) => eelAt(i));
        this.live = null; this.seen = false;
        ensureTextures(scene);
    }

    build() {
        const s = this.scene, src = s.textures.get(EEL).getSourceImage(), items = [];
        for (const e of this.eels) {
            e.ground = this.groundY(e.x);
            if (e.ground === null) { e.img = null; continue; }
            items.push(s.add.image(e.x, e.ground + 2, HOLE).setDepth(EEL_LOOK.depth - 0.05));
            e.img = s.add.image(e.x, e.ground + 4, EEL).setOrigin(0.5, 1).setDepth(EEL_LOOK.depth);
            e.base = e.height / src.height;
            items.push(e.img);
        }
        return { items };
    }

    /** Per frame. `fish` = { x, y }, `t` s, `dt` s. */
    update(fish, t, dt) {
        const L = EEL_LOOK, sp = this.spot;
        if (this.live && (fish.x < sp.x0 - L.far || fish.x > sp.x1 + L.far)) this.clear();
        if (!this.live) {
            if (fish.x < sp.x0 - L.near || fish.x > sp.x1 + L.near || !this.scene.buildSlot()) return;
            this.live = this.build();
        }
        for (const e of this.eels) {
            if (!e.img) continue;
            stepEel(e, scared(e.x, e.ground, fish.x, fish.y), dt);
            e.img.setScale(e.base, e.base * Math.max(0.02, e.out)).setRotation(Math.sin(t * 1.3 + e.phase) * L.sway * e.out);
            e.img.setVisible(e.out > 0.03);
        }
        if (!this.seen && Math.abs(fish.x - (sp.x0 + sp.x1) / 2) < GARDEN_EELS.seen) { this.seen = true; this.onSeen('garden_eels'); }
    }

    clear() {
        for (const o of this.live.items) o.destroy();
        for (const e of this.eels) e.img = null;
        this.live = null;
    }
}
