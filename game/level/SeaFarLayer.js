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
    // The island's socket: a shoulder of rock climbing to the right. Its outline is rock, not a
    // ramp: big shoulders and ledges, small knobs, two buttresses that lean out, and a rim that
    // thins into the water; a few far plants stand on its upper shoulder.
    soft('seafar_socket', 900, 700, 6, (c, w, h) => {
        const edge = t => {      // height of the outline (0 bottom .. 1 top) at t = 0 left .. 1 right
            const base = Math.pow(t, 1.25);
            const ledges = Math.round(base * 6) / 6 * 0.35 + base * 0.65;                          // steps: ledges
            const big = Math.sin(t * 9.1 + 0.6) * 0.035 + Math.sin(t * 4.3 + 2.1) * 0.05;          // shoulders
            const knobs = Math.sin(t * 61) * 0.008 + Math.sin(t * 37 + 1.3) * 0.012;               // knobs
            return Math.max(0, Math.min(1, ledges + (big + knobs) * Math.min(1, t * 4)));
        };
        const outline = grow => {
            c.beginPath(); c.moveTo(0, h);
            for (let i = 0; i <= 180; i++) {
                const t = i / 180;
                // Buttresses: at two places the rock leans out to the left over the water below it.
                const lean = 46 * Math.exp(-((t - 0.42) ** 2) / 0.0016) + 60 * Math.exp(-((t - 0.71) ** 2) / 0.002);
                c.lineTo(t * w - lean - grow, h - edge(t) * h - grow);
            }
            c.lineTo(w, 0); c.lineTo(w, h); c.closePath();
        };
        c.globalAlpha = 0.3; outline(26); c.fill();       // the rim, thin and hazy
        c.globalAlpha = 0.6; outline(11); c.fill();
        c.globalAlpha = 1; outline(0); c.fill();
        c.lineWidth = 5;                                  // far plants on the upper shoulder
        for (let i = 0; i < 9; i++) {
            const t = 0.5 + i * 0.05, x = t * w - 8, y = h - edge(t) * h, tall = 40 + (i * 37) % 50;
            c.beginPath(); c.moveTo(x, y + 4); c.quadraticCurveTo(x + (i % 2 ? 12 : -12), y - tall * 0.5, x + (i % 3 - 1) * 8, y - tall); c.stroke();
        }
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
        this.snow = [];      // made when the open sea is first reached (makeSnow)
        this.out = { x: 0, alpha: 0 };
    }

    makeSnow() {
        const scene = this.scene, W = scene.scale.width, H = scene.scale.height, L = SEA_FAR_LOOK;
        this.snow = Array.from({ length: L.snow }, (_, i) => {
            const f = scene.add.image(((i * 0.618) % 1) * W, ((i * 0.381) % 1) * H, 'seafar_snow').setScrollFactor(0).setDepth(-9).setVisible(false);
            f.drift = 0.5 + ((i * 0.27) % 1); f.setScale(L.snowScale[0] + (L.snowScale[1] - L.snowScale[0]) * (f.drift - 0.5));      // near flakes are bigger and move more
            return f;
        });
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
        if (show && !this.snow.length) this.makeSnow();
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
