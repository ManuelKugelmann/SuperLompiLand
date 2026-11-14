import { skyItems, screenX, onScreen, volcanoAt } from './skyline.js';

export const SKY = {
    showAbove: 80,      // world y of the camera's top edge below which nothing of the sky is on screen
    baseY: 34,          // world y the coast shapes stand on (just under the waterline, so the waves cover their feet)
    blur: 5,            // px of blur baked into the far shapes (out of focus on purpose, spec 10.12)
    haze: 0.86,         // alpha of the far shapes: the air between takes the rest
    clouds: 7,
    cloudDrift: 6,      // px per second
    cloudScroll: 0.02,  // clouds pass this share of the camera's movement
    birds: 5,
    birdSpeed: 38,      // px per second
    smoke: 5            // puffs in the volcano's plume
};

// Every shape is painted once on a canvas, blurred, and reused. Sizes in px.
const SHAPES = {
    palms: [640, 300, (c, w, h) => {
        blob(c, w * 0.5, h, w * 0.46, h * 0.3, '#e9d9a8');
        blob(c, w * 0.5, h * 0.96, w * 0.34, h * 0.24, '#7fb98a');
        for (const [x, lean, tall] of [[0.34, -0.25, 0.62], [0.5, 0.12, 0.8], [0.63, 0.3, 0.55]]) palm(c, w * x, h * 0.78, lean, h * tall);
    }],
    canopy: [820, 240, (c, w, h) => {
        blob(c, w * 0.5, h, w * 0.5, h * 0.22, '#5d8f6a');
        for (let i = 0; i < 9; i++) blob(c, w * (0.1 + i * 0.1), h * (0.62 + (i % 3) * 0.06), w * 0.09, h * (0.34 + (i % 2) * 0.1), i % 2 ? '#4f9a6c' : '#6fb07c');
        c.strokeStyle = '#4b6a58'; c.lineWidth = 5;
        for (let i = 0; i < 12; i++) { const x = w * (0.08 + i * 0.076); c.beginPath(); c.moveTo(x, h * 0.74); c.quadraticCurveTo(x + 14, h * 0.9, x + (i % 2 ? 22 : -18), h); c.stroke(); }
    }],
    light: [560, 340, (c, w, h) => {
        rock(c, w, h, 0.5, 0.42, '#8f9a9c');
        c.fillStyle = '#f4f1e6'; c.fillRect(w * 0.47, h * 0.24, w * 0.05, h * 0.36);
        c.fillStyle = '#d9584a'; c.fillRect(w * 0.47, h * 0.36, w * 0.05, h * 0.06);
        c.fillStyle = '#5b6468'; c.fillRect(w * 0.46, h * 0.19, w * 0.07, h * 0.05);
        c.fillStyle = '#fff3b0'; c.beginPath(); c.arc(w * 0.495, h * 0.2, 9, 0, 7); c.fill();
        c.fillStyle = '#e8e2d2'; c.fillRect(w * 0.55, h * 0.5, w * 0.1, h * 0.09);     // keeper's cottage
        c.fillStyle = '#b5574a'; c.beginPath(); c.moveTo(w * 0.54, h * 0.5); c.lineTo(w * 0.6, h * 0.43); c.lineTo(w * 0.66, h * 0.5); c.fill();
    }],
    stacks: [520, 300, (c, w, h) => {
        rock(c, w, h, 0.3, 0.2, '#7f8a8f'); rock(c, w, h, 0.62, 0.34, '#8b969a'); rock(c, w, h, 0.84, 0.14, '#768186');
        blob(c, w * 0.62, h * 0.42, w * 0.07, h * 0.04, '#7da682');
    }],
    ship: [420, 150, (c, w, h) => {
        c.fillStyle = '#5f6f80';
        c.beginPath(); c.moveTo(w * 0.06, h * 0.62); c.lineTo(w * 0.94, h * 0.62); c.lineTo(w * 0.86, h * 0.92); c.lineTo(w * 0.12, h * 0.92); c.fill();
        c.fillStyle = '#e6e9ec'; c.fillRect(w * 0.68, h * 0.34, w * 0.14, h * 0.28);
        c.fillStyle = '#c96a4a'; c.fillRect(w * 0.73, h * 0.16, w * 0.04, h * 0.2);
        for (let i = 0; i < 5; i++) { c.fillStyle = ['#c98a4a', '#5f93b0', '#b4b97a'][i % 3]; c.fillRect(w * (0.18 + i * 0.095), h * 0.44, w * 0.085, h * 0.18); }
    }],
    port: [900, 320, (c, w, h) => {
        blob(c, w * 0.5, h, w * 0.5, h * 0.2, '#8d9088');
        c.fillStyle = '#9aa0a0'; for (const [x, bw, bh] of [[0.1, 0.16, 0.2], [0.3, 0.12, 0.28], [0.62, 0.2, 0.18], [0.84, 0.1, 0.24]]) c.fillRect(w * x, h * (0.84 - bh), w * bw, h * bh);
        c.strokeStyle = '#6b7780'; c.lineWidth = 9;
        for (const x of [0.48, 0.74]) {                                                // gantry cranes
            c.beginPath(); c.moveTo(w * x, h * 0.84); c.lineTo(w * x, h * 0.3); c.lineTo(w * (x + 0.07), h * 0.84); c.stroke();
            c.beginPath(); c.moveTo(w * (x - 0.09), h * 0.3); c.lineTo(w * (x + 0.13), h * 0.22); c.stroke();
        }
        c.fillStyle = '#ffe9a8'; for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(w * (0.12 + i * 0.095), h * (0.66 + (i % 3) * 0.04), 7, 0, 7); c.fill(); }   // lights as bokeh dots
    }],
    volcano: [1100, 620, (c, w, h) => {
        const g = c.createLinearGradient(0, h * 0.1, 0, h);
        g.addColorStop(0, '#5b4a52'); g.addColorStop(0.5, '#6f6670'); g.addColorStop(1, '#8f9aa6');
        c.fillStyle = g;
        c.beginPath(); c.moveTo(0, h); c.quadraticCurveTo(w * 0.3, h * 0.82, w * 0.43, h * 0.16); c.lineTo(w * 0.57, h * 0.16); c.quadraticCurveTo(w * 0.7, h * 0.82, w, h); c.fill();
        const lava = c.createRadialGradient(w * 0.5, h * 0.16, 4, w * 0.5, h * 0.16, w * 0.12);
        lava.addColorStop(0, 'rgba(255,190,90,1)'); lava.addColorStop(0.4, 'rgba(255,90,40,0.7)'); lava.addColorStop(1, 'rgba(255,60,30,0)');
        c.fillStyle = lava; c.fillRect(w * 0.36, 0, w * 0.28, h * 0.34);
        c.strokeStyle = 'rgba(255,120,60,0.75)'; c.lineWidth = 7;                       // lava running down
        c.beginPath(); c.moveTo(w * 0.5, h * 0.17); c.quadraticCurveTo(w * 0.55, h * 0.4, w * 0.52, h * 0.62); c.stroke();
    }]
};

function blob(c, x, y, rx, ry, colour) { c.fillStyle = colour; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }

function rock(c, w, h, at, wide, colour) {
    c.fillStyle = colour;
    const x = w * at, half = w * wide * 0.5, top = h * (1 - wide * 1.9);
    c.beginPath(); c.moveTo(x - half, h); c.quadraticCurveTo(x - half * 0.8, top + h * 0.1, x - half * 0.2, top);
    c.lineTo(x + half * 0.35, top + h * 0.05); c.quadraticCurveTo(x + half * 0.9, top + h * 0.2, x + half, h); c.fill();
}

function palm(c, x, y, lean, tall) {
    const tx = x + lean * tall * 0.5, ty = y - tall;
    c.strokeStyle = '#8a7350'; c.lineWidth = 9;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + lean * tall * 0.1, y - tall * 0.6, tx, ty); c.stroke();
    c.strokeStyle = '#4f9a6c'; c.lineWidth = 11; c.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
        const a = Math.PI * (1.05 + i * 0.15), r = tall * 0.42;
        c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(tx + Math.cos(a) * r * 0.6, ty + Math.sin(a) * r * 0.9, tx + Math.cos(a) * r, ty + Math.sin(a) * r * 0.25 + r * 0.3); c.stroke();
    }
}

/** Paint a soft texture once. `draw(ctx, w, h)` paints sharp; the blur is added here. */
function soft(scene, key, w, h, draw, blur = SKY.blur) {
    if (scene.textures.exists(key)) return;
    const pad = blur * 3, sharp = document.createElement('canvas');
    sharp.width = w; sharp.height = h;
    draw(sharp.getContext('2d'), w, h);
    const tex = scene.textures.createCanvas(key, w + pad * 2, h + pad), ctx = tex.getContext();
    ctx.filter = `blur(${blur}px)`;     // where the browser has no canvas filter the shapes stay sharp-edged, still muted
    ctx.drawImage(sharp, pad, pad);
    tex.refresh();
}

/**
 * The world above the water (spec 10.12): drifting clouds, a few birds, the coast of the
 * biome you are in, and the volcano far in the east. All of it far, soft and out of focus;
 * it stands in the sky layer of the backdrop, behind the waterline. Screen x, world y.
 */
export default class SkyLayer {
    constructor(scene) {
        this.scene = scene;
        const W = scene.scale.width;
        for (const [kind, [w, h, draw]] of Object.entries(SHAPES)) soft(scene, `sky_${kind}`, w, h, draw);
        for (let k = 0; k < 3; k++) {
            soft(scene, `sky_cloud${k}`, 520, 190, (c, w, h) => {
                for (let i = 0; i < 6; i++) blob(c, w * (0.18 + i * 0.13), h * (0.62 - ((i + k) % 3) * 0.12), w * (0.14 + ((i * 7 + k) % 4) * 0.02), h * (0.24 + ((i + k) % 2) * 0.08), '#ffffff');
                blob(c, w * 0.5, h * 0.78, w * 0.42, h * 0.16, '#e9f3f7');
            }, 9);
        }
        soft(scene, 'sky_bird', 64, 28, (c, w, h) => {
            c.strokeStyle = '#4a5a68'; c.lineWidth = 5; c.lineCap = 'round';
            c.beginPath(); c.moveTo(4, h * 0.3); c.quadraticCurveTo(w * 0.3, h * 0.1, w * 0.5, h * 0.7); c.quadraticCurveTo(w * 0.7, h * 0.1, w - 4, h * 0.3); c.stroke();
        }, 1.5);
        const img = (key, depth) => scene.add.image(0, 0, key).setScrollFactor(0, 1).setDepth(depth).setVisible(false);

        this.clouds = Array.from({ length: SKY.clouds }, (_, i) => {
            const c = img(`sky_cloud${i % 3}`, -29.2).setAlpha(0.55 + (i % 3) * 0.15);
            c.wx = (i / SKY.clouds) * (W + 700) + (i % 2) * 130;
            c.setY(-260 - (i * 137) % 760).setScale(0.7 + (i % 4) * 0.25);
            return c;
        });
        // The plume first, so the mountain stands in front of its foot.
        this.smoke = Array.from({ length: SKY.smoke }, () => img('sky_cloud1', -28.9).setTint(0x6d6470));
        this.volcano = img('sky_volcano', -28.8).setOrigin(0.5, 1).setAlpha(SKY.haze);
        this.items = skyItems().map(item => {
            const o = img(`sky_${item.kind}`, -28.7 + item.scroll).setOrigin(0.5, 1).setScale(item.size).setAlpha(SKY.haze * (0.75 + item.scroll * 1.5));
            o.item = item;
            return o;
        });
        this.birds = Array.from({ length: SKY.birds }, (_, i) => {
            const b = img('sky_bird', -28.5).setAlpha(0.7);
            b.ox = i * 70 + (i % 2) * 30; b.oy = (i % 3) * 34 - (i % 2) * 22; b.phase = i * 1.7;
            return b;
        });
        this.flock = { x: W * 0.3, y: -330, dir: 1 };
    }

    /** Per frame; `camX`, `camY` = the camera's top left corner in the world. */
    update(camX, camY) {
        const W = this.scene.scale.width, t = this.scene.time.now / 1000, cam = camX + W / 2;
        const show = camY < SKY.showAbove;
        if (!show && !this.shown) return;
        this.shown = show;
        const span = W + 700;
        for (const c of this.clouds) {
            const sx = ((c.wx + t * SKY.cloudDrift - camX * SKY.cloudScroll) % span + span) % span - 350;
            c.setVisible(show).setX(sx);
        }
        for (const o of this.items) {
            const sx = screenX(o.item, cam, W);
            o.setVisible(show && onScreen(sx, o.displayWidth / 2, W)).setPosition(sx, SKY.baseY);
        }
        const v = volcanoAt(cam, W);
        this.volcano.setVisible(show).setPosition(v.x, SKY.baseY).setScale(v.size);
        const top = SKY.baseY - this.volcano.displayHeight * 0.86;
        this.smoke.forEach((s, i) => {
            // Each puff rises from the crater, drifts east, grows and thins, then starts again.
            const k = (t * 0.07 + i / SKY.smoke) % 1;
            s.setVisible(show).setPosition(v.x + k * 260 * v.size, top - k * 330 * v.size).setScale((0.35 + k * 0.9) * v.size).setAlpha(0.5 * (1 - k) * Math.min(1, k * 6));
        });
        const f = this.flock;
        f.x += f.dir * SKY.birdSpeed * this.scene.game.loop.delta / 1000;
        if (f.x > W + 500) f.dir = -1; else if (f.x < -500) f.dir = 1;
        for (const b of this.birds) {
            b.setVisible(show).setPosition(f.x - f.dir * b.ox, f.y + b.oy + Math.sin(t * 0.6 + b.phase) * 14)
                .setScale(f.dir * 0.8, 0.5 + 0.5 * Math.sin(t * 7 + b.phase));   // wing beat
        }
    }
}
