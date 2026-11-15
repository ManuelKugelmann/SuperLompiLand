// A small "blub": the mouth opens into a round o and closes again, at the painted mouth (rig/faces.js),
// with every breath's bubble and when a coin is taken (CardRig.blub). Procedural (one shared texture),
// made only while it shows.
export const RIG_MOUTH = {
    key: 'rig_mouth',
    size: 0.1,        // the open o's size, share of the picture's height
    ms: 260,          // how long one blub takes, open and closed again
    tint: 0x5a1e2a    // the inside of the mouth
};

function ensureTexture(scene) {
    if (scene.textures.exists(RIG_MOUTH.key)) return;
    const S = 64, t = scene.textures.createCanvas(RIG_MOUTH.key, S, S), c = t.getContext(), h = S / 2;
    const g = c.createRadialGradient(h, h * 1.1, 2, h, h, h);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.75, '#d9d9d9'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(h, h, h - 2, h - 2, 0, 0, Math.PI * 2); c.fill();
    // A lighter lip on the lower rim (tinted with the rest, it reads as the inside's edge).
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 4;
    c.beginPath(); c.ellipse(h, h, h - 6, h - 6, 0, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
    t.refresh();
}

export default class RigMouth {
    constructor(scene) { this.scene = scene; this.t = -1; this.img = null; this.depth = 0; }

    /** Start a blub (ignored while one runs). */
    blub() { if (this.t < 0) this.t = 0; }

    setDepth(d) { this.depth = d; this.img?.setDepth(d); return this; }

    hide() { this.img?.destroy(); this.img = null; }

    /** Per frame: `at` = { x, y, s } where the mouth is and the picture's scale; `h` = picture height px; `dt` s. */
    update(at, h, rotation, alpha, dt) {
        if (this.t < 0) { this.hide(); return; }
        this.t += dt * 1000 / RIG_MOUTH.ms;
        if (this.t >= 1) { this.t = -1; this.hide(); return; }
        if (!this.img) {
            ensureTexture(this.scene);
            this.img = this.scene.add.image(0, 0, RIG_MOUTH.key).setTint(RIG_MOUTH.tint).setDepth(this.depth);
            this.img.noCaustics = true;
        }
        const open = Math.sin(Math.PI * this.t), d = h * RIG_MOUTH.size * at.s / 64;
        this.img.setPosition(at.x, at.y).setRotation(rotation).setScale(d * (0.7 + 0.3 * open), d * open).setAlpha(alpha);
    }

    destroy() { this.hide(); }
}
