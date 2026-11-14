import { seaShare } from './biomes.js';
import { socketView, passing } from './seaFar.js';

export const SEA_FAR_LOOK = {
    depth: -21,          // behind every other far layer
    tint: 0x0b3350,      // the colour of things seen through a lot of water
    socketTint: 0x04192c, // the island's socket: darker than the water around it, so it reads as rock
    snow: 44,            // flakes of marine snow
    snowFall: 22,        // px per second
    snowAlpha: 0.75,
    snowScale: [1.2, 3.2],   // the nearest flakes are big and bright
    passAlpha: 0.22,
    passSize: 900        // px length of a big shape at scale 1
};

/** Soft pictures, painted once: everything out here is seen through haze. */
function ensureTextures(scene) {
    const soft = (key, w, h, blur, draw) => {
        if (scene.textures.exists(key)) return;
        const sharp = document.createElement('canvas');
        sharp.width = w; sharp.height = h;
        const c = sharp.getContext('2d');
        c.fillStyle = '#ffffff'; c.strokeStyle = '#ffffff'; c.lineCap = 'round';
        draw(c, w, h);
        const tex = scene.textures.createCanvas(key, w, h), ctx = tex.getContext();
        ctx.filter = `blur(${blur}px)`;
        ctx.drawImage(sharp, 0, 0);
        tex.refresh();
    };
    // The island's socket: a broad shoulder of rock climbing to the right, ledges on its flank.
    soft('seafar_socket', 900, 700, 10, (c, w, h) => {
        c.beginPath(); c.moveTo(0, h);
        c.bezierCurveTo(w * 0.2, h * 0.92, w * 0.3, h * 0.7, w * 0.45, h * 0.62);
        c.bezierCurveTo(w * 0.55, h * 0.56, w * 0.6, h * 0.36, w * 0.74, h * 0.26);
        c.bezierCurveTo(w * 0.84, h * 0.18, w * 0.9, h * 0.06, w, 0);
        c.lineTo(w, h); c.closePath(); c.fill();
    });
    soft('seafar_manta', 512, 220, 5, (c, w, h) => {
        c.beginPath(); c.moveTo(w * 0.9, h * 0.5);
        c.quadraticCurveTo(w * 0.6, h * 0.05, w * 0.42, h * 0.02); c.quadraticCurveTo(w * 0.5, h * 0.4, w * 0.3, h * 0.5);
        c.quadraticCurveTo(w * 0.5, h * 0.6, w * 0.42, h * 0.98); c.quadraticCurveTo(w * 0.6, h * 0.95, w * 0.9, h * 0.5); c.fill();
        c.lineWidth = 5; c.beginPath(); c.moveTo(w * 0.32, h * 0.5); c.lineTo(w * 0.02, h * 0.52); c.stroke();      // tail
    });
    soft('seafar_shark', 512, 180, 5, (c, w, h) => {
        c.beginPath(); c.ellipse(w * 0.56, h * 0.52, w * 0.36, h * 0.2, 0, 0, 7); c.fill();
        c.beginPath(); c.moveTo(w * 0.24, h * 0.52); c.lineTo(w * 0.03, h * 0.12); c.lineTo(w * 0.12, h * 0.52); c.lineTo(w * 0.05, h * 0.86); c.closePath(); c.fill();   // tail fin
        c.beginPath(); c.moveTo(w * 0.5, h * 0.36); c.lineTo(w * 0.56, h * 0.04); c.lineTo(w * 0.66, h * 0.36); c.fill();                                                 // back fin
        c.beginPath(); c.moveTo(w * 0.62, h * 0.66); c.lineTo(w * 0.52, h * 0.98); c.lineTo(w * 0.72, h * 0.68); c.fill();                                               // side fin
    });
    soft('seafar_school', 512, 220, 3, (c, w, h) => {
        for (let i = 0; i < 46; i++) {
            const x = w * (0.08 + ((i * 0.618) % 1) * 0.84), y = h * (0.15 + ((i * 0.377) % 1) * 0.7);
            c.beginPath(); c.ellipse(x, y, 15, 5, 0, 0, 7); c.fill();
            c.beginPath(); c.moveTo(x - 13, y); c.lineTo(x - 22, y - 6); c.lineTo(x - 22, y + 6); c.fill();
        }
    });
    soft('seafar_snow', 16, 16, 1.5, (c, w) => { c.beginPath(); c.arc(w / 2, w / 2, 3.5, 0, 7); c.fill(); });
}

/**
 * The far view of the open sea (level/seaFar.js is the rule): the socket of the island ahead
 * in the haze, marine snow sinking past, and now and then something big crossing far away.
 * Shown only where the play plane is open sea. Everything is in screen space.
 */
export default class SeaFarLayer {
    constructor(scene) {
        this.scene = scene;
        ensureTextures(scene);
        const W = scene.scale.width, H = scene.scale.height, L = SEA_FAR_LOOK;
        const img = key => scene.add.image(0, 0, key).setScrollFactor(0).setDepth(L.depth).setTint(L.tint).setVisible(false);
        this.socket = img('seafar_socket').setOrigin(0, 1).setDisplaySize(W * 0.95, H * 1.05).setTint(L.socketTint);
        this.pass = { img: img('seafar_manta'), n: 0, t: 0, spec: passing(0), waiting: true };
        this.snow = Array.from({ length: L.snow }, (_, i) => {
            const f = scene.add.image(((i * 0.618) % 1) * W, ((i * 0.381) % 1) * H, 'seafar_snow').setScrollFactor(0).setDepth(-9).setVisible(false);
            f.drift = 0.5 + ((i * 0.27) % 1); f.setScale(L.snowScale[0] + (L.snowScale[1] - L.snowScale[0]) * (f.drift - 0.5));      // near flakes are bigger and move more
            return f;
        });
        this.out = { x: 0, alpha: 0 };
    }

    /** Per frame; `camX`, `camY` = the camera's top left in the world, `dx`, `dy` = how far it moved, `delta` ms. */
    update(camX, camY, dx, dy, delta) {
        const W = this.scene.scale.width, H = this.scene.scale.height, L = SEA_FAR_LOOK, dt = delta / 1000;
        const cam = camX + W / 2, sea = seaShare(cam), under = camY > -H * 0.5 ? 1 : 0;      // nothing of this while flying high above the water

        const v = socketView(cam, W, undefined, this.out);
        this.socket.setVisible(!!v && under > 0);
        // It stands on the bottom of the view and sinks out of it as the camera climbs toward the surface.
        if (v) this.socket.setPosition(v.x, H * 1.02 + Math.max(0, 500 - camY) * 0.25).setAlpha(v.alpha);

        // Marine snow: sinks slowly, slides against the camera's movement, wraps round the screen.
        const show = sea > 0.05 && camY > 60;
        for (const f of this.snow) {
            f.setVisible(show);
            if (!show) continue;
            f.x = ((f.x - dx * 0.6 * f.drift) % W + W) % W;
            f.y = ((f.y + (L.snowFall * dt - dy * 0.6) * f.drift) % H + H) % H;
            f.setAlpha(L.snowAlpha * sea * (0.35 + 0.65 * (f.drift - 0.5)));
        }

        // One big shape at a time, far away: it waits out of sight, crosses, and the next one is drawn.
        const p = this.pass;
        p.t += dt;
        if (p.waiting) {
            if (p.t >= p.spec.wait && sea > 0.5) { p.waiting = false; p.t = 0; p.img.setTexture(`seafar_${p.spec.kind}`); }
            else { p.img.setVisible(false); return; }
        }
        const k = p.t / p.spec.time, len = L.passSize * p.spec.scale;
        if (k >= 1) { p.waiting = true; p.t = 0; p.spec = passing(++p.n); p.img.setVisible(false); return; }
        const from = p.spec.dir > 0 ? -len : W + len, to = p.spec.dir > 0 ? W + len : -len;
        p.img.setVisible(show).setPosition(from + (to - from) * k, H * p.spec.depth + Math.sin(p.t * 0.5) * 30)
            .setDisplaySize(len, len * p.img.frame.height / p.img.frame.width).setFlipX(p.spec.dir < 0)
            .setAlpha(L.passAlpha * sea * (0.5 + 0.5 * p.spec.scale) * Math.min(1, k * 8, (1 - k) * 8));
    }
}
