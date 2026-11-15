// The mouth at the painted mouth (rig/faces.js), procedural (two shared textures), made only while it shows:
//   blub  it opens into a round o and closes again, with every breath's bubble and when a coin is taken;
//   grin  a wide beaming grin (rig/wave.js: waving hello), held as long as the caller says.
export const RIG_MOUTH = {
    key: 'rig_mouth',
    size: 0.1,        // the open o's size, share of the picture's height
    ms: 260,          // how long one blub takes, open and closed again
    tint: 0x5a1e2a,   // the inside of the mouth
    grinKey: 'rig_grin',
    grin: 0.34,       // the grin's width, share of the picture's height
    grinBack: 0.22    // its middle sits this share of its width back from the mouth point (toward the cheek)
};

function ensureTextures(scene) {
    if (!scene.textures.exists(RIG_MOUTH.key)) {
        const S = 64, t = scene.textures.createCanvas(RIG_MOUTH.key, S, S), c = t.getContext(), h = S / 2;
        const g = c.createRadialGradient(h, h * 1.1, 2, h, h, h);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.75, '#d9d9d9'); g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(h, h, h - 2, h - 2, 0, 0, Math.PI * 2); c.fill();
        // A lighter lip on the lower rim (tinted with the rest, it reads as the inside's edge).
        c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 4;
        c.beginPath(); c.ellipse(h, h, h - 6, h - 6, 0, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
        t.refresh();
    }
    if (!scene.textures.exists(RIG_MOUTH.grinKey)) {
        // A wide open smile: a gently curved top lip with its row of teeth, a deep round bottom, a tongue.
        const W = 128, H = 72, t = scene.textures.createCanvas(RIG_MOUTH.grinKey, W, H), c = t.getContext();
        const shape = () => { c.beginPath(); c.moveTo(6, 14); c.quadraticCurveTo(64, 30, 122, 14); c.quadraticCurveTo(64, 112, 6, 14); c.closePath(); };
        shape();
        const g = c.createLinearGradient(0, 14, 0, 64);
        g.addColorStop(0, '#6e1a26'); g.addColorStop(1, '#3a0b14');
        c.fillStyle = g; c.fill();
        c.save(); shape(); c.clip();
        c.fillStyle = '#e8657a'; c.beginPath(); c.ellipse(64, 64, 34, 16, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#fbfbf6'; c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W, 18); c.quadraticCurveTo(64, 46, 0, 18); c.closePath(); c.fill();
        c.restore();
        c.strokeStyle = 'rgba(70,14,24,0.95)'; c.lineWidth = 4; c.lineJoin = 'round'; c.lineCap = 'round';
        shape(); c.stroke();
        t.refresh();
    }
}

export default class RigMouth {
    constructor(scene) { this.scene = scene; this.t = -1; this.img = null; this.grinImg = null; this.depth = 0; }

    /** Start a blub (ignored while one runs). */
    blub() { if (this.t < 0) this.t = 0; }

    setDepth(d) { this.depth = d; this.img?.setDepth(d); this.grinImg?.setDepth(d); return this; }

    hide() { this.img?.destroy(); this.img = null; this.grinImg?.destroy(); this.grinImg = null; }

    /** The rig moved without being posed (slow tiers): the mouth moves with it. */
    shift(dx, dy) { for (const i of [this.img, this.grinImg]) if (i) { i.x += dx; i.y += dy; } }

    /**
     * Per frame: `at` = { x, y, sy } where the mouth is and the picture's scale; `h` = picture height px;
     * `dt` s; `facing` the way the nose points; `grin` 0..1 how wide it beams (0: none).
     */
    update(at, h, rotation, alpha, dt, facing = 1, grin = 0) {
        if (grin > 0.01) {
            ensureTextures(this.scene);
            if (!this.grinImg) { this.grinImg = this.scene.add.image(0, 0, RIG_MOUTH.grinKey).setDepth(this.depth); this.grinImg.noCaustics = true; }
            const w = h * RIG_MOUTH.grin * at.sy, back = -facing * w * RIG_MOUTH.grinBack * grin;
            this.grinImg.setPosition(at.x + back * Math.cos(rotation), at.y + back * Math.sin(rotation)).setRotation(rotation)
                .setScale(w / 128 * (0.55 + 0.45 * grin), w / 128 * grin).setAlpha(alpha);
        } else if (this.grinImg) { this.grinImg.destroy(); this.grinImg = null; }
        if (this.t < 0 || grin > 0.01) { this.t = -1; this.img?.destroy(); this.img = null; return; }      // (no blub while grinning)
        this.t += dt * 1000 / RIG_MOUTH.ms;
        if (this.t >= 1) { this.t = -1; this.img?.destroy(); this.img = null; return; }
        if (!this.img) {
            ensureTextures(this.scene);
            this.img = this.scene.add.image(0, 0, RIG_MOUTH.key).setTint(RIG_MOUTH.tint).setDepth(this.depth);
            this.img.noCaustics = true;
        }
        const open = Math.sin(Math.PI * this.t), d = h * RIG_MOUTH.size * at.sy / 64;
        this.img.setPosition(at.x, at.y).setRotation(rotation).setScale(d * (0.7 + 0.3 * open), d * open).setAlpha(alpha);
    }

    destroy() { this.hide(); }
}
