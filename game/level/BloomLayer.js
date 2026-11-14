import { BLOOM, bloomFields, jellyAt, bumpAside } from './blooms.js';

export const BLOOM_LOOK = {
    near: 3200, far: 5200,   // px from a field at which its jellies are built, and beyond which they are removed
    size: [150, 92],     // px tall of a big jelly and of a small one
    alpha: [0.92, 0.6],
    depth: [4.7, 1.4],   // the big ones just behind the fish, the small ones further back
    ease: 0.12,          // share per step by which a jelly follows a bump and drifts back
    pulse: 0.07          // share of its height a jelly rises and sinks with its own beat
};

/** The painted moon jelly (loaded by the title screen); drawn procedurally while missing. */
export const BLOOM_ART = { moon_jelly: 'img/rescue/moon_jelly.webp' };

const KEYS = ['bloom_jelly', 'bloom_jelly_small'];

/** One small picture per size, baked once (a Blitter draws every jelly of a size from it). */
function ensureTextures(scene) {
    KEYS.forEach((key, k) => {
        if (scene.textures.exists(key)) return;
        const h = BLOOM_LOOK.size[k], src = scene.textures.exists('moon_jelly') ? scene.textures.get('moon_jelly').getSourceImage() : null;
        const w = Math.round(src ? h * src.width / src.height : h * 0.9), tex = scene.textures.createCanvas(key, w, h), c = tex.getContext();
        if (src) c.drawImage(src, 0, 0, w, h);
        else {
            // A moon jelly: a pale bell with four rings in it and a few trailing arms.
            c.strokeStyle = 'rgba(214,226,255,0.7)'; c.lineWidth = Math.max(2, h * 0.03); c.lineCap = 'round';
            for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(w / 2 + i * w * 0.12, h * 0.42); c.quadraticCurveTo(w / 2 + i * w * 0.2, h * 0.7, w / 2 + i * w * 0.1, h * 0.96); c.stroke(); }
            const g = c.createRadialGradient(w / 2, h * 0.3, 2, w / 2, h * 0.3, w * 0.5);
            g.addColorStop(0, 'rgba(255,240,250,0.95)'); g.addColorStop(1, 'rgba(190,206,246,0.55)');
            c.fillStyle = g; c.beginPath(); c.ellipse(w / 2, h * 0.44, w * 0.48, h * 0.4, 0, Math.PI, 0); c.closePath(); c.fill();
            c.strokeStyle = 'rgba(170,140,230,0.8)';
            for (const [dx, dy] of [[-0.18, 0.24], [0.18, 0.24], [-0.24, 0.36], [0.24, 0.36]]) { c.beginPath(); c.arc(w / 2 + dx * w, h * dy, w * 0.08, 0, 7); c.stroke(); }
        }
        tex.refresh();
    });
}

const POS = {}, PUSH = { x: 0, y: 0 };

/**
 * What a bloom field looks like (level/blooms.js says where the fields are and how a jelly
 * drifts): two Blitters per field, one for the big jellies and one for the small ones behind
 * them. Built only while the fish is near. `onSeen()` is called the first time the fish is in one.
 */
export default class BloomLayer {
    constructor(scene, onSeen) {
        this.scene = scene; this.onSeen = onSeen; this.seen = false;
        this.fields = bloomFields();
        this.live = null;      // { field, blitters: [big, small], bobs: [{ bob, i, k, ox, oy }] }
    }

    build(field) {
        ensureTextures(this.scene);
        const L = BLOOM_LOOK, blitters = KEYS.map((key, k) => this.scene.add.blitter(0, 0, key).setDepth(L.depth[k]).setAlpha(L.alpha[k])), bobs = [];
        for (let i = 0; i < BLOOM.count; i++) {
            const k = jellyAt(field, i, 0, POS).small ? 1 : 0;
            bobs.push({ bob: blitters[k].create(0, 0), i, k, ox: 0, oy: 0 });
        }
        return { field, blitters, bobs };
    }

    /** Per frame. `fish` = { x, y }, `t` s, `delta` ms. */
    update(fish, t, delta) {
        const L = BLOOM_LOOK;
        if (this.live && (fish.x < this.live.field.x0 - L.far || fish.x > this.live.field.x1 + L.far)) { for (const b of this.live.blitters) b.destroy(); this.live = null; }
        if (!this.live) {
            const f = this.fields.find(fl => fish.x > fl.x0 - L.near && fish.x < fl.x1 + L.near);
            if (!f) return;
            this.live = this.build(f);
        }
        const { field, bobs } = this.live, k = 1 - Math.pow(1 - L.ease, delta / (1000 / 60));
        for (const j of bobs) {
            const p = jellyAt(field, j.i, t, POS), h = L.size[j.k], w = this.scene.textures.get(KEYS[j.k]).getSourceImage().width;
            // Only the big ones share the fish's plane: they are the ones it bumps aside.
            const push = j.k === 0 ? bumpAside(p.x + j.ox, p.y + j.oy, fish.x, fish.y, PUSH) : (PUSH.x = 0, PUSH.y = 0, PUSH);
            j.ox += (push.x - j.ox) * k * (push.x || push.y ? 1 : 0.25); j.oy += (push.y - j.oy) * k * (push.x || push.y ? 1 : 0.25);
            j.bob.setPosition(p.x + j.ox - w / 2, p.y + j.oy - h / 2 - Math.sin(t * 1.9 + j.i) * h * L.pulse);
        }
        if (!this.seen && Math.abs(fish.x - (field.x0 + field.x1) / 2) < BLOOM.seen && fish.y < field.bottom + 200) { this.seen = true; this.onSeen(); }
    }
}
