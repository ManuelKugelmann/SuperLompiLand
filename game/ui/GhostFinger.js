import { GHOST, fingerAt, shouldShow } from './ghostDemo.js';

/**
 * Draws the ghost finger (ghostDemo.js scripts it) in a scheme's screen-space layer: a soft
 * fingertip, a ring where it presses and an elastic band from the fish to the finger. Baked
 * images only, moved per frame. Plays on the first starts, and bows out the moment the child
 * touches the screen.
 *
 *   this.demo = GhostFinger.maybe(scene, this.ui)          (null when not shown)
 *   draw():    this.demo?.update(dtSeconds, fishScreenX, fishScreenY)
 *   input:     this.demo?.stop()
 */
export default class GhostFinger {
    static maybe(scene, ui, scheme = 'tap') {
        let runs = 0;
        const key = `${GHOST.key}_${scheme}`;     // each scheme is shown on its own first starts
        try { runs = Number(window.localStorage.getItem(key)) || 0; window.localStorage.setItem(key, String(runs + 1)); } catch { /* storage blocked */ }
        return shouldShow(runs) ? new GhostFinger(scene, ui, scheme) : null;
    }

    constructor(scene, ui, scheme = 'tap') {
        this.scene = scene; this.scheme = scheme; this.t = 0; this.done = false;
        bake(scene);
        this.band = scene.add.image(0, 0, 'ghost_band').setOrigin(0, 0.5).setAlpha(0);
        this.ring = scene.add.image(0, 0, 'ghost_ring').setAlpha(0);
        this.finger = scene.add.image(0, 0, 'ghost_finger').setOrigin(0.32, 0.06).setAlpha(0);
        ui.add([this.band, this.ring, this.finger]);
    }

    update(dt, fx, fy) {
        if (this.done) return;
        this.t += dt;
        const f = fingerAt(this.t, this.scheme);
        if (f.done) { this.stop(); return; }
        const x = fx + f.x, y = fy + f.y;
        this.finger.setPosition(x, y).setAlpha(f.alpha * 0.9).setScale(f.down ? 1.2 : 1.35).setRotation(f.rot);
        if (f.ring >= 0) this.ring.setPosition(x, y).setScale(0.4 + f.ring * 0.9).setAlpha((1 - f.ring) * 0.8 * f.alpha);
        else this.ring.setAlpha(0);
        if (f.band > 0) {
            const bx = fx + f.bandFrom[0], by = fy + f.bandFrom[1], dx = x - bx, dy = y - by, len = Math.hypot(dx, dy);
            this.band.setPosition(bx, by).setRotation(Math.atan2(dy, dx)).setScale(len / 64, 1).setAlpha(0.7 * f.band * f.alpha);
        } else this.band.setAlpha(0);
    }

    stop() {
        if (this.done) return;
        this.done = true;
        for (const o of [this.band, this.ring, this.finger]) {
            this.scene.tweens.add({ targets: o, alpha: 0, duration: 250, onComplete: () => o.destroy() });
        }
    }
}

/** The finger, the press ring and a piece of elastic band, painted once. */
function bake(scene) {
    const tex = scene.textures;
    if (!tex.exists('ghost_finger')) {
        const t = tex.createCanvas('ghost_finger', 90, 170), c = t.getContext();
        c.shadowColor = 'rgba(0,30,60,0.35)'; c.shadowBlur = 10; c.shadowOffsetY = 4;
        c.fillStyle = 'rgba(255,255,255,0.95)';
        c.beginPath();                                   // a fingertip pointing up, the hand below
        c.moveTo(14, 40); c.arc(29, 32, 17, Math.PI, 0); c.lineTo(46, 96); c.quadraticCurveTo(80, 100, 82, 130);
        c.lineTo(82, 168); c.lineTo(10, 168); c.quadraticCurveTo(6, 120, 14, 96); c.closePath(); c.fill();
        c.shadowColor = 'transparent';
        c.strokeStyle = 'rgba(80,120,150,0.6)'; c.lineWidth = 3; c.stroke();
        c.fillStyle = 'rgba(220,235,245,0.9)';           // the nail
        c.beginPath(); c.ellipse(29, 26, 9, 8, 0, 0, Math.PI * 2); c.fill();
        t.refresh();
    }
    if (!tex.exists('ghost_ring')) {
        const t = tex.createCanvas('ghost_ring', 120, 120), c = t.getContext();
        c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 7;
        c.beginPath(); c.arc(60, 60, 50, 0, Math.PI * 2); c.stroke();
        t.refresh();
    }
    if (!tex.exists('ghost_band')) {
        const t = tex.createCanvas('ghost_band', 64, 14), c = t.getContext();
        const g = c.createLinearGradient(0, 0, 0, 14);
        g.addColorStop(0, 'rgba(255,214,90,0)'); g.addColorStop(0.5, 'rgba(255,214,90,1)'); g.addColorStop(1, 'rgba(255,214,90,0)');
        c.fillStyle = g; c.fillRect(0, 0, 64, 14);
        t.refresh();
    }
}
