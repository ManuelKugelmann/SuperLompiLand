import { SEAL, sealSpot, createSeal, stepSeal, sealBob } from './seal.js';

export const SEAL_LOOK = { depth: 4.3, lean: 0.3 };      // just behind the fish; how much of its head's turn the whole picture leans

/** The painted seal (loaded by the title screen): hanging upright, nose up; asleep, and awake with its eyes open and its head turned (to the right). Drawn procedurally while missing. */
export const SEAL_ART = { harbour_seal: 'img/harbour_seal.webp', harbour_seal_awake: 'img/harbour_seal_awake.webp' };

const ASLEEP = 'harbour_seal', AWAKE = 'harbour_seal_awake';

function ensureTextures(scene) {
    const T = scene.textures;
    for (const [key, open] of [[ASLEEP, false], [AWAKE, true]]) {
        if (T.exists(key)) continue;
        const W = 128, H = 256, t = T.createCanvas(key, W, H), c = t.getContext(), g = c.createLinearGradient(0, 0, W, 0);
        // Hanging upright: a spotted grey spindle, fore flippers folded on the chest, hind flippers at the bottom.
        g.addColorStop(0, '#6f7a80'); g.addColorStop(0.55, '#a9b3b6'); g.addColorStop(1, '#7c878c');
        c.fillStyle = g;
        c.beginPath(); c.moveTo(64, 40); c.bezierCurveTo(110, 60, 112, 160, 78, 226); c.lineTo(50, 226); c.bezierCurveTo(16, 160, 18, 60, 64, 40); c.fill();
        c.fillStyle = '#59646a';
        c.beginPath(); c.moveTo(52, 222); c.quadraticCurveTo(30, 252, 44, 254); c.quadraticCurveTo(60, 246, 64, 226); c.quadraticCurveTo(68, 246, 84, 254); c.quadraticCurveTo(98, 252, 76, 222); c.fill();
        c.beginPath(); c.ellipse(40, 124, 9, 28, 0.35, 0, Math.PI * 2); c.ellipse(88, 124, 9, 28, -0.35, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(60,70,76,0.5)';
        for (let i = 0; i < 22; i++) { c.beginPath(); c.arc(36 + (i * 37) % 56, 70 + (i * 53) % 140, 2 + (i % 3), 0, Math.PI * 2); c.fill(); }
        // The head: asleep it points up, nose to the surface; awake it is turned to the right, eyes open.
        c.save(); c.translate(64, 40); c.rotate(open ? 0.15 : -Math.PI / 2 + 0.2);
        c.fillStyle = '#a9b3b6'; c.beginPath(); c.ellipse(0, 0, 30, 26, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#c3cbcd'; c.beginPath(); c.ellipse(22, 6, 15, 12, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#2a2f33'; c.beginPath(); c.arc(35, 3, 3, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#2a2f33'; c.lineWidth = 3; c.lineCap = 'round';
        if (open) { c.fillStyle = '#15181a'; c.beginPath(); c.arc(8, -8, 5.5, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(10, -10, 1.8, 0, Math.PI * 2); c.fill(); }
        else { c.beginPath(); c.moveTo(2, -7); c.quadraticCurveTo(8, -3, 14, -7); c.stroke(); }
        c.strokeStyle = 'rgba(240,244,245,0.8)'; c.lineWidth = 1.5;
        for (const dy of [-5, 0, 5]) { c.beginPath(); c.moveTo(24, 9); c.lineTo(42, 11 + dy); c.stroke(); }
        c.restore();
        t.refresh();
    }
}

/**
 * Draws the harbour seal (seal.js): one picture asleep, one awake (turned toward the fish, leaning after it).
 *   create():  this.seal = new SealLayer(scene, routeY, onSeen)
 *   update():  this.seal.update(fish, t, dt)      // fish = { x, y }, t and dt in s
 */
export default class SealLayer {
    constructor(scene, routeY, onSeen) {
        this.scene = scene; this.routeY = routeY; this.onSeen = onSeen;
        this.spot = sealSpot();
        this.built = null; this.seal = createSeal(); this.seen = false; this.breathAt = 0;
    }

    update(fish, t, dt) {
        const d = Math.abs(fish.x - this.spot.x);
        if (this.built && d > SEAL.near * 1.4) { this.destroy(); return; }
        if (!this.built) {
            if (d > SEAL.near || !this.scene.buildSlot()) return;
            ensureTextures(this.scene);
            const img = this.scene.add.image(0, 0, ASLEEP).setOrigin(0.5, 0.2).setDepth(SEAL_LOOK.depth);
            this.built = { img, cy: this.routeY(this.spot.x) - SEAL.above };
            this.seal = createSeal();
        }
        const B = this.built, x = this.spot.x, top = B.cy - SEAL.height / 2 + sealBob(t), hy = top + SEAL.height * 0.2;      // hy: its head
        const seal = stepSeal(this.seal, fish.x - x, fish.y - hy, dt);
        // Awake it faces the fish and leans after it a little (turning round its head); asleep it only sways.
        B.img.setTexture(seal.awake ? AWAKE : ASLEEP).setPosition(x, hy).setFlipX(seal.side < 0)
            .setRotation(Math.sin(t * 0.5) * 0.03 + seal.head * seal.side * SEAL_LOOK.lean);
        B.img.setScale(SEAL.height / B.img.height);
        // Asleep it lets a bubble go now and then.
        if (!seal.awake && t > this.breathAt) {
            this.breathAt = t + SEAL.breathS;
            this.scene.particles?.spawn('bubble', x + seal.side * 30, hy, 1, { radius: 6, spread: 8 });
        }
        if (!this.seen && Math.hypot(fish.x - x, fish.y - hy) < SEAL.seen) { this.seen = true; this.onSeen(); }
    }

    destroy() {
        if (!this.built) return;
        this.built.img.destroy();
        this.built = null;
    }
}
