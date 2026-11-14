import Phaser from 'phaser';
import { WEATHER, stormShare, stormSpan, downwelling } from '../level/weather.js';
import { ensureFoam, SURF_ART } from './SurfLayer.js';

export const STORM_LOOK = {
    sky: 0.6,          // how dark the sky gets in the middle of the storm
    gloom: 0.3,        // how much darker the water gets under it
    rain: 46,          // rain streaks
    rainSpeed: 1500,   // px per second
    slant: 0.35,       // the rain falls this much sideways (the wind blows west)
    // Seen from below:
    underside: [{ y: 8, h: 90, speed: 260, alpha: 0.85, tint: 0xa9bcc8 }, { y: 30, h: 60, speed: 430, alpha: 0.6, tint: 0xd4e2ea }],   // the churned surface
    heave: 16,         // px the underside rises and falls
    bands: 0.42,       // wave shadows sweeping over the light (alpha)
    bandsSpeed: 190,   // px per second they run west
    bandsReach: 900,   // px under the surface where the shadows fade out
    torn: 9,           // foam puffs torn west in the churned layer
    tornSpeed: [520, 880],
    debris: 6,         // planks and seaweed tumbling west
    debrisSpeed: [260, 520],
    edge: 0.75,        // how dark the side of the view toward the storm gets (its edge reads from afar)
    // The downwelling:
    bubbleMs: 70,      // one burst of bubbles in each column this often
    bubbleSpeed: 420,  // px per second they stream down (or up)
    streak: [{ alpha: 0.85, speed: 330, scale: 1 }, { alpha: 0.5, speed: 190, scale: 0.6 }],   // two depths of streaks in each column
    whirl: 0.9         // radians per second the whirl at the top of the down column turns
};

const TEX = { bands: 'storm_bands', col: 'current_col', whirl: 'current_whirl', plank: 'storm_plank', weed: 'storm_weed', edge: 'storm_edge' };

/** Small deterministic random source. */
function rnd(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** The storm's and the current's pictures, painted once (no art files needed). */
function bake(scene) {
    const T = scene.textures, r = rnd(5);
    if (!T.exists(TEX.bands)) {
        // Wave shadows: soft dark bands across the light, strongest at the top, tiling sideways.
        const W = 512, H = 256, tex = T.createCanvas(TEX.bands, W, H), c = tex.getContext();
        for (let i = 0; i < 9; i++) {
            const x = r() * W, w = 30 + r() * 90, lean = (r() - 0.5) * 80;
            for (const ox of [-W, 0, W]) {
                const g = c.createLinearGradient(x + ox - w, 0, x + ox + w, 0);
                g.addColorStop(0, 'rgba(6,16,26,0)'); g.addColorStop(0.5, `rgba(6,16,26,${0.5 + r() * 0.5})`); g.addColorStop(1, 'rgba(6,16,26,0)');
                c.fillStyle = g;
                c.beginPath(); c.moveTo(x + ox - w, 0); c.lineTo(x + ox + w, 0); c.lineTo(x + ox + w + lean, H); c.lineTo(x + ox - w + lean, H); c.fill();
            }
        }
        c.globalCompositeOperation = 'destination-in';
        const fade = c.createLinearGradient(0, 0, 0, H);
        fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0.15)');
        c.fillStyle = fade; c.fillRect(0, 0, W, H);
        tex.refresh();
    }
    if (!T.exists(TEX.col)) {
        // A slice of the current, tiling downward: darker banded water, soft at its sides, full
        // of streaks of bubbles, silt and marine snow pulled along.
        const W = 256, H = 512, tex = T.createCanvas(TEX.col, W, H), c = tex.getContext();
        for (let i = 0; i < 7; i++) {
            const x = 30 + r() * (W - 60), w = 14 + r() * 40;
            const g = c.createLinearGradient(x - w, 0, x + w, 0);
            g.addColorStop(0, 'rgba(4,20,48,0)'); g.addColorStop(0.5, `rgba(4,20,48,${0.25 + r() * 0.3})`); g.addColorStop(1, 'rgba(4,20,48,0)');
            c.fillStyle = g; c.fillRect(x - w, 0, w * 2, H);
        }
        const dash = (x, y, len, wdt, col) => {
            for (const oy of [-H, 0, H]) { c.fillStyle = col; c.fillRect(x - wdt / 2, y + oy, wdt, len); }
        };
        for (let i = 0; i < 260; i++) {            // marine snow and silt: short pale streaks
            const x = 20 + r() * (W - 40), y = r() * H;
            dash(x, y, 6 + r() * 34, 1 + r() * 1.6, `rgba(${200 + r() * 40},${215 + r() * 30},${225 + r() * 30},${0.35 + r() * 0.45})`);
        }
        for (let i = 0; i < 70; i++) {             // bubbles, stretched by the pull
            const x = 24 + r() * (W - 48), y = r() * H, rad = 2 + r() * 4;
            for (const oy of [-H, 0, H]) {
                c.strokeStyle = `rgba(235,250,255,${0.55 + r() * 0.35})`; c.lineWidth = 1.4;
                c.beginPath(); c.ellipse(x, y + oy, rad, rad * 1.8, 0, 0, Math.PI * 2); c.stroke();
            }
        }
        c.globalCompositeOperation = 'destination-in';   // soft sides
        const side = c.createLinearGradient(0, 0, W, 0);
        side.addColorStop(0, 'rgba(0,0,0,0)'); side.addColorStop(0.22, 'rgba(0,0,0,1)'); side.addColorStop(0.78, 'rgba(0,0,0,1)'); side.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = side; c.fillRect(0, 0, W, H);
        tex.refresh();
    }
    if (!T.exists(TEX.whirl)) {
        // The whirl at the top of the down column: curved streaks spiralling in.
        const S = 256, tex = T.createCanvas(TEX.whirl, S, S), c = tex.getContext();
        c.translate(S / 2, S / 2);
        for (let arm = 0; arm < 7; arm++) {
            const a0 = arm / 7 * Math.PI * 2;
            c.strokeStyle = `rgba(225,245,255,${0.35 + r() * 0.35})`; c.lineWidth = 2 + r() * 3; c.lineCap = 'round';
            c.beginPath();
            for (let k = 0; k <= 30; k++) {
                const t = k / 30, rr = 120 * (1 - t) + 8, a = a0 + t * 3.2;
                const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
                if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
            }
            c.stroke();
        }
        const g = c.createRadialGradient(0, 0, 0, 0, 0, 60);
        g.addColorStop(0, 'rgba(4,22,52,0.6)'); g.addColorStop(1, 'rgba(4,22,52,0)');
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, 60, 0, Math.PI * 2); c.fill();
        tex.refresh();
    }
    if (!T.exists(TEX.plank)) {
        const W = 110, H = 22, tex = T.createCanvas(TEX.plank, W, H), c = tex.getContext();
        c.fillStyle = '#6b5136'; c.fillRect(2, 3, W - 4, H - 6);
        c.strokeStyle = 'rgba(40,28,16,0.6)'; c.lineWidth = 1;
        for (let i = 0; i < 5; i++) { const y = 5 + i * 3 + r() * 2; c.beginPath(); c.moveTo(4, y); c.bezierCurveTo(40, y + 2, 70, y - 2, W - 4, y + 1); c.stroke(); }
        c.fillStyle = 'rgba(255,240,210,0.18)'; c.fillRect(2, 3, W - 4, 3);
        c.clearRect(W - 14, 3, 12, 6);   // a broken corner
        tex.refresh();
    }
    if (!T.exists(TEX.weed)) {
        const W = 90, H = 64, tex = T.createCanvas(TEX.weed, W, H), c = tex.getContext();
        for (let i = 0; i < 14; i++) {
            c.strokeStyle = `rgba(${70 + r() * 50},${100 + r() * 50},${40 + r() * 30},0.95)`; c.lineWidth = 3 + r() * 4; c.lineCap = 'round';
            const x0 = W / 2 + (r() - 0.5) * 20, y0 = H / 2 + (r() - 0.5) * 14, a = r() * Math.PI * 2, L = 18 + r() * 24;
            c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(x0 + Math.cos(a + 0.8) * L * 0.6, y0 + Math.sin(a + 0.8) * L * 0.6, x0 + Math.cos(a) * L, y0 + Math.sin(a) * L * 0.7); c.stroke();
        }
        tex.refresh();
    }
    if (!T.exists(TEX.edge)) {
        const tex = T.createCanvas(TEX.edge, 256, 4), c = tex.getContext(), g = c.createLinearGradient(0, 0, 256, 0);
        g.addColorStop(0, 'rgba(10,20,32,0)'); g.addColorStop(1, 'rgba(10,20,32,1)');
        c.fillStyle = g; c.fillRect(0, 0, 256, 4);
        tex.refresh();
    }
}

/**
 * What the open sea's two exceptions look like (level/weather.js is the rule).
 * Storm: the sky darkens and rain slants down above the waterline. From below, the surface's
 * underside heaves, churned to foam that runs west; wave shadows sweep over the light and cut
 * the sun shafts; foam, bubbles, planks and seaweed are torn west through the top layer; and
 * the side of the view toward the storm dims, so its edge is seen long before it is felt.
 * Downwelling: a column of darker water streaked with bubbles, silt and marine snow, all
 * pulled down (up in the other column), with a whirl at its top; readable from a screen away.
 */
export default class StormLayer {
    constructor(scene) {
        this.scene = scene;
        ensureFoam(scene);
        bake(scene);
        const W = scene.scale.width, H = scene.scale.height, L = STORM_LOOK;
        this.span = stormSpan();
        // Behind the waterline: over the sky, clouds and horizon, under the sea's top edge.
        this.sky = scene.add.rectangle(0, 0, W, H, 0x1c2733, 0).setOrigin(0).setScrollFactor(0).setDepth(-28.3).setVisible(false);
        // In front of the world: the light goes out of the water too, more on the storm's side.
        this.gloom = scene.add.rectangle(0, 0, W, H, 0x0e1a26, 0).setOrigin(0).setScrollFactor(0).setDepth(6.5).setVisible(false);
        this.edge = scene.add.image(0, 0, TEX.edge).setOrigin(0).setScrollFactor(0).setDisplaySize(W, H).setDepth(6.49).setVisible(false);
        // One tile tall (stretched over the view), so it only repeats sideways.
        this.bands = scene.add.tileSprite(0, 0, W, H, TEX.bands).setOrigin(0).setScrollFactor(0).setDepth(5.65).setVisible(false);
        this.bands.setTileScale(H / 256, H / 256);
        this.under = L.underside.map(u => scene.add.tileSprite(0, u.y, W + 400, u.h, SURF_ART.line.key).setOrigin(0, 0.5)
            .setDepth(6.4).setTint(u.tint).setVisible(false));
        this.rain = Array.from({ length: L.rain }, (_, i) => {
            const r = scene.add.rectangle(0, 0, 3, 46 + (i % 3) * 18, 0xdbe8f2, 0.5).setScrollFactor(0, 1).setDepth(-28.2).setVisible(false)
                .setRotation(L.slant);
            r.sx = ((i * 0.6180339) % 1) * (W + 300); r.fall = ((i * 0.3819) % 1);
            return r;
        });
        const R = rnd(9);
        const flyer = (key, frame, i) => {
            const o = scene.add.image(0, 0, key, frame).setDepth(6.3).setVisible(false);
            o.life = -R() * 2; o.vx = 0; o.spin = 0;
            return o;
        };
        const puffFrames = scene.textures.get(SURF_ART.puffs.key).frameTotal > 2;
        this.torn = Array.from({ length: L.torn }, (_, i) => flyer(SURF_ART.puffs.key, puffFrames ? i % 4 : undefined, i));
        this.debris = Array.from({ length: L.debris }, (_, i) => flyer(i % 2 ? TEX.weed : TEX.plank, undefined, i));
        // The downwelling's two columns: streaks at two depths, a whirl at the top of the one going down.
        const d = WEATHER.down, cols = downwelling(), top = d.top, bottom = d.routeY + 250;
        this.cols = cols;
        this.columns = [];
        if (!scene.textures.exists('current_fade')) {
            // Soft ends for the columns (a mask: the current fades in under the surface and out at depth).
            const tex = scene.textures.createCanvas('current_fade', 4, 256), c = tex.getContext(), g = c.createLinearGradient(0, 0, 0, 256);
            g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.12, 'rgba(0,0,0,1)'); g.addColorStop(0.8, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            c.fillStyle = g; c.fillRect(0, 0, 4, 256); tex.refresh();
        }
        for (const [x, dir] of [[cols.down, 1], [cols.up, -1]]) {
            const fade = scene.make.image({ x, y: top, key: 'current_fade', add: false }).setOrigin(0.5, 0).setDisplaySize(d.halfWidth * 2, bottom - top);
            const mask = fade.createBitmapMask();
            for (const s of L.streak) {
                const t = scene.add.tileSprite(x, top, d.halfWidth * 2 * (0.7 + 0.3 * s.scale), bottom - top, TEX.col).setOrigin(0.5, 0)
                    .setDepth(2.6 + s.scale * 0.2).setAlpha(s.alpha).setTileScale(s.scale, s.scale).setVisible(false);
                t.dir = dir; t.speed = s.speed; t.cx = x;
                t.setMask(mask);
                this.columns.push(t);
            }
        }
        // The whirl turns in a flattened container, so it reads as a funnel seen from the side.
        this.whirlSpin = scene.add.image(0, 0, TEX.whirl);
        this.whirl = scene.add.container(cols.down, top + 10, [this.whirlSpin]).setDepth(2.9).setScale(2.6, 1.1).setVisible(false);
        this.nextBubbles = 0;
        this.rand = R;
    }

    /** Per frame; `camX`, `camY` = the camera's top left in the world, `particles` = the scene's particle layer. */
    update(camX, camY, t, delta, particles) {
        const W = this.scene.scale.width, H = this.scene.scale.height, L = STORM_LOOK, dt = delta / 1000;
        const kl = stormShare(camX), kr = stormShare(camX + W), k = stormShare(camX + W / 2);
        const near = Math.max(kl, kr), on = near > 0.01;
        this.sky.setVisible(k > 0.01).setAlpha(L.sky * k);
        this.gloom.setVisible(on).setAlpha(L.gloom * Math.min(kl, kr));
        // The side toward the storm is darker: the light dims ahead (as far as a view beyond
        // the screen's edge) before you get there.
        const ahead = stormShare(camX + W * 2), behind = stormShare(camX - W);
        const diff = Math.max(Math.abs(ahead - kl), Math.abs(behind - kr)) * (1 - Math.min(kl, kr));
        this.edge.setVisible(diff > 0.01).setAlpha(Math.min(1, diff * L.edge)).setFlipX(behind - kr > ahead - kl);
        const wet = k > 0.01 && camY < 60;      // rain only where the sky is in view
        for (const r of this.rain) {
            r.setVisible(wet);
            if (!wet) continue;
            r.fall = (r.fall + L.rainSpeed * dt / 1100) % 1;
            r.setPosition(((r.sx - r.fall * 1100 * L.slant) % (W + 300) + W + 300) % (W + 300) - 150, -1100 + r.fall * 1100).setAlpha(0.55 * k);
        }
        // Seen from below: only while the surface is near the view.
        const shallow = Phaser.Math.Clamp(1 - camY / L.bandsReach, 0, 1);
        const from = on && camY < 400;
        this.under.forEach((u, i) => {
            const cfg = L.underside[i];
            u.setVisible(from);
            if (!from) return;
            u.x = camX - 200; u.tilePositionX = camX + t * cfg.speed;
            u.y = cfg.y + Math.sin(t * (1.1 + i * 0.4) + i) * L.heave;
            u.scaleY = 1 + 0.25 * Math.sin(t * 0.9 + i * 2);
            u.setAlpha(cfg.alpha * near);
        });
        const flicker = 0.75 + 0.25 * Math.sin(t * 6.3) * Math.sin(t * 2.2 + 1);
        this.bands.setVisible(on && shallow > 0.01).setAlpha(L.bands * near * shallow * flicker);
        if (on) this.bands.tilePositionX = (camX * 0.6 + t * L.bandsSpeed) / this.bands.tileScaleX;
        // Torn foam, bubbles and debris in the churned layer (world px 0..storm depth).
        const S = WEATHER.storm, R = this.rand;
        const fly = (o, speeds, scale, spin) => {
            o.life -= dt;
            if (o.life > 0 && o.visible) {
                o.x += o.vx * dt; o.rotation += o.spin * dt;
                o.y += Math.sin(t * 2 + o.seed) * 30 * dt;
                if (o.x < camX - 300) o.life = 0;
                return;
            }
            const sx = camX + W + 100, ky = stormShare(sx);
            if (camY > S.depth + 100 || ky < 0.2 || R() > 0.02 + 0.08 * ky) { o.setVisible(false); return; }
            o.setPosition(sx, 10 + R() * S.depth * 0.9).setVisible(true).setScale(scale * (0.6 + R() * 0.7)).setAlpha(0.6 + R() * 0.35);
            o.vx = -(speeds[0] + R() * (speeds[1] - speeds[0])) * ky; o.spin = (R() - 0.5) * spin; o.seed = R() * 9; o.life = 6;
        };
        for (const o of this.torn) fly(o, L.tornSpeed, 0.55, 1.5);
        for (const o of this.debris) fly(o, L.debrisSpeed, 1, 3.2);
        if (on && camY < S.depth && R() < near * 0.5) {
            particles.spawn('bubble', camX + W * (0.3 + R() * 0.8), 20 + R() * S.depth * 0.8, 2, { vx: -600 * near, vy: 0, spread: 60 });
        }

        // The downwelling: streaks pulled down one column and up the other, a whirl over the first.
        const d = WEATHER.down;
        for (const c of this.columns) {
            const seen = c.cx > camX - d.halfWidth - W && c.cx < camX + W + d.halfWidth + W;   // from a screen away
            c.setVisible(seen);
            if (seen) c.tilePositionY = -c.dir * t * c.speed / c.tileScaleY;
        }
        const ws = this.cols.down > camX - W && this.cols.down < camX + 2 * W;
        this.whirl.setVisible(ws);
        if (ws) this.whirlSpin.rotation = -t * L.whirl;
        this.nextBubbles -= delta;
        if (this.nextBubbles > 0) return;
        this.nextBubbles = L.bubbleMs;
        for (const [x, dir] of [[this.cols.down, 1], [this.cols.up, -1]]) {
            if (x < camX - d.halfWidth || x > camX + W + d.halfWidth) continue;
            const y0 = Math.max(d.top, camY - 100), y1 = Math.min(d.routeY + 250, camY + H + 100);
            if (y1 <= y0) continue;
            const y = y0 + ((t * 7.3 + x) % 1) * (y1 - y0);
            particles.spawn('bubble', x + Math.sin(t * 5 + y) * d.halfWidth * 0.6, y, 2, { radius: 12, spread: 40, vy: dir * L.bubbleSpeed });
        }
    }
}
