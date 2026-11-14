import { SECRETS, secretSpots, placeSecret } from './secrets.js';

/**
 * The hidden pearls (level/secrets.js): a clam on the seabed under the route that opens a little and
 * glows when Lompi comes close; touching it takes the pearl. Built only near; found pearls stay gone.
 *
 *   create():  this.secrets = new SecretLayer(scene, seabed, routeY, found, onFind)
 *   update():  this.secrets.update(fish, t)
 */
export const SECRET_LOOK = { near: 1800, far: 2800, depth: 3.4, size: 110, open: 420 };

const CLAM = 'secret_clam', PEARL = 'secret_pearl', BOTTLE = 'secret_bottle';

/** Painted clam and pearl, if they exist, replace the drawn ones. */
export const SECRET_ART = { [CLAM]: 'img/secret_clam.png', [PEARL]: 'img/secret_pearl.png' };

function ensureTextures(scene) {
    const tex = scene.textures, TAU = Math.PI * 2;
    if (!tex.exists(CLAM)) {
        // A giant clam seen from the side: two wavy shell halves, the upper one tipped open.
        const W = 160, H = 110, t = tex.createCanvas(CLAM, W, H), c = t.getContext();
        const shell = (y0, flip) => {
            const g = c.createLinearGradient(0, y0 - 30 * flip, 0, y0 + 30 * flip);
            g.addColorStop(0, '#f2d7b6'); g.addColorStop(1, '#a8805c');
            c.fillStyle = g; c.beginPath(); c.moveTo(10, y0);
            for (let i = 0; i <= 8; i++) c.lineTo(10 + i * 17.5, y0 - flip * (34 - Math.abs(i - 4) * 5 + (i % 2) * 6));
            c.lineTo(150, y0); c.closePath(); c.fill();
            c.strokeStyle = 'rgba(120,80,50,0.5)'; c.lineWidth = 2;
            for (let i = 1; i < 8; i++) { c.beginPath(); c.moveTo(80, y0); c.lineTo(10 + i * 17.5, y0 - flip * 28); c.stroke(); }
        };
        shell(78, -1); shell(70, 1);
        c.fillStyle = '#5a3a6a'; c.beginPath(); c.ellipse(80, 74, 52, 7, 0, 0, TAU); c.fill();
        t.refresh();
    }
    if (!tex.exists(BOTTLE)) {
        // A green glass bottle with a rolled message inside and a cork, lying a little tilted.
        const W = 120, H = 56, t = tex.createCanvas(BOTTLE, W, H), c = t.getContext();
        c.fillStyle = 'rgba(90,170,120,0.75)'; c.beginPath(); c.ellipse(52, 28, 44, 20, 0, 0, TAU); c.fill();
        c.fillRect(88, 20, 22, 16); c.fillStyle = '#a0763f'; c.fillRect(106, 18, 10, 20);
        c.fillStyle = '#f1e2bf'; c.fillRect(30, 20, 44, 14); c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 3;
        c.beginPath(); c.ellipse(46, 18, 26, 5, -0.1, Math.PI, TAU); c.stroke(); t.refresh();
    }
    if (!tex.exists(PEARL)) {
        const S = 48, t = tex.createCanvas(PEARL, S, S), c = t.getContext(), g = c.createRadialGradient(S * 0.4, S * 0.35, 2, S / 2, S / 2, S / 2);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#f4ecff'); g.addColorStop(1, '#c9b8e8');
        c.fillStyle = g; c.beginPath(); c.arc(S / 2, S / 2, S / 2 - 2, 0, TAU); c.fill(); t.refresh();
    }
}

export default class SecretLayer {
    constructor(scene, seabed, routeY, found, onFind) {
        this.scene = scene; this.seabed = seabed; this.routeY = routeY; this.found = found; this.onFind = onFind;
        this.spots = secretSpots().filter(s => !found.has(s.id));
        ensureTextures(scene);
    }

    /** Per frame. `fish` = { x, y }, `t` s. */
    update(fish, t) {
        const L = SECRET_LOOK;
        for (const s of this.spots) {
            const dx = Math.abs(fish.x - s.x);
            if (s.live && dx > L.far) { s.live.clam.destroy(); s.live.pearl.destroy(); s.live = null; }
            if (s.taken || s.live === undefined && dx > L.near) continue;
            if (!s.live) {
                if (dx > L.near || !this.scene.buildSlot()) continue;
                // On the seabed in a clam; where there is none in reach, a message bottle drifts in the open water.
                s.place ??= placeSecret(s.x, x => this.seabed(x), this.routeY) ?? { x: s.x, y: this.routeY(s.x) + SECRETS.bottleUnder, bottle: true };
                const clam = this.scene.add.image(s.place.x, s.place.y + 8, s.place.bottle ? BOTTLE : CLAM).setOrigin(0.5, 1).setDepth(L.depth);
                clam.setScale(L.size / clam.width);
                const pearl = this.scene.add.image(s.place.x, s.place.y - 14, PEARL).setDepth(L.depth + 0.01).setScale(0.6).setBlendMode('ADD');
                s.live = { clam, pearl };
            }
            // Close by, the clam opens a little and the pearl shines (a hint to dive down).
            const d = Math.hypot(fish.x - s.place.x, fish.y - s.place.y), near = Math.max(0, 1 - d / L.open);
            s.live.pearl.setAlpha(0.35 + 0.65 * near * (0.8 + 0.2 * Math.sin(t * 4))).setScale(0.55 + 0.25 * near);
            if (s.place.bottle) s.live.clam.setPosition(s.place.x, s.place.y + 8 + Math.sin(t * 1.3) * 10).setRotation(Math.sin(t * 0.9) * 0.15);
            else s.live.clam.setScale(s.live.clam.scaleX, (L.size / s.live.clam.width) * (1 + 0.12 * near));
            if (d < SECRETS.take) {
                s.taken = true;
                const { pearl } = s.live;
                this.scene.tweens.add({ targets: pearl, y: pearl.y - 160, alpha: 0, scale: 1.2, duration: 700, ease: 'Sine.easeOut', onComplete: () => pearl.destroy() });
                this.found.add(s.id);
                this.onFind(s, s.place.x, s.place.y);
            }
        }
    }
}
