import { GANNETS, gannetSpot, volley, volleyS, gannetAt } from './gannets.js';

export const GANNET_LOOK = { depth: 4.5 };      // just behind the fish

/** The little fish a gannet comes up with (loaded by the title screen; drawn procedurally while missing). The bird itself is the seabirds' painted diving gannet. */
export const GANNET_ART = { gannet_catch: 'img/gannet_catch.webp' };

// PAINTED: the seabirds' diving gannet (bill down). BIRD: drawn here while that is missing (bill right).
const PAINTED = 'gannet_dive', BIRD = 'gannet_dart', CATCH = 'gannet_catch';

function ensureTextures(scene) {
    const T = scene.textures;
    if (!T.exists(BIRD)) {
        // A white dart, bill right: yellowish head, long grey bill, black wing tips folded back.
        const W = 192, H = 64, t = T.createCanvas(BIRD, W, H), c = t.getContext();
        c.fillStyle = '#f4f6f6'; c.beginPath(); c.moveTo(14, 32); c.bezierCurveTo(50, 8, 120, 10, 150, 26); c.lineTo(150, 38); c.bezierCurveTo(120, 54, 50, 56, 14, 32); c.fill();
        c.fillStyle = '#20262b'; c.beginPath(); c.moveTo(4, 30); c.lineTo(70, 22); c.lineTo(52, 32); c.lineTo(70, 42); c.lineTo(4, 34); c.fill();
        c.fillStyle = '#f0d98a'; c.beginPath(); c.ellipse(144, 32, 16, 11, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#9fb2bd'; c.beginPath(); c.moveTo(156, 27); c.lineTo(190, 32); c.lineTo(156, 37); c.fill();
        c.fillStyle = '#15181a'; c.beginPath(); c.arc(150, 29, 2.4, 0, Math.PI * 2); c.fill();
        t.refresh();
    }
    if (!T.exists(CATCH)) {
        const W = 40, H = 16, t = T.createCanvas(CATCH, W, H), c = t.getContext();
        c.fillStyle = '#cfd9e0'; c.beginPath(); c.ellipse(22, 8, 15, 5.5, 0, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.moveTo(8, 8); c.lineTo(0, 2); c.lineTo(0, 14); c.fill();
        t.refresh();
    }
}

/**
 * Draws the gannets (gannets.js): they exist only during a volley.
 *   create():  this.gannets = new GannetLayer(scene, surfaceY, onSeen)
 *   update():  this.gannets.update(fish, heading, t)      // fish = { x, y }, heading +1 east, t in s
 */
export default class GannetLayer {
    constructor(scene, surfaceY, onSeen) {
        this.scene = scene; this.surfaceY = surfaceY; this.onSeen = onSeen;
        this.spot = gannetSpot();
        this.live = null;      // { start, birds: [{ p, img, fish, part, bubbleAt }] }
        this.next = 0; this.count = 0; this.seen = false; this.p = {};
    }

    update(fish, heading, t) {
        const G = GANNETS;
        if (!this.live) {
            if (fish.x < this.spot.x0 || fish.x > this.spot.x1 || t < this.next || !this.scene.buildSlot()) return;
            ensureTextures(this.scene);
            const s = this.scene, painted = s.textures.exists(PAINTED), key = painted ? PAINTED : BIRD, fr = s.textures.getFrame(key);
            const k = G.length / (painted ? fr.height : fr.width);
            this.turn = painted ? -Math.PI / 2 : 0;      // the painted bird points down, the drawn one right
            this.live = { start: t, birds: volley(fish.x, heading >= 0 ? 1 : -1, this.count++ * 7).map(p => ({
                p, part: 'wait', bubbleAt: 0,
                img: s.add.image(p.x, 0, key).setDepth(GANNET_LOOK.depth).setScale(k).setVisible(false),
                fish: s.add.image(p.x, 0, CATCH).setDepth(GANNET_LOOK.depth + 0.01).setDisplaySize(G.length * 0.3, G.length * 0.12).setVisible(false)
            })) };
        }
        const L = this.live, u0 = t - L.start, particles = this.scene.particles;
        if (u0 > volleyS()) {
            for (const b of L.birds) { b.img.destroy(); b.fish.destroy(); }
            this.live = null; this.next = t + G.restS;
            return;
        }
        for (const b of L.birds) {
            const surface = this.surfaceY(b.p.x), g = gannetAt(b.p, u0 - b.p.at, surface, this.p), on = g.part !== 'wait' && g.part !== 'gone';
            b.img.setVisible(on); b.fish.setVisible(on && g.fish);
            if (g.part === 'plunge' && b.part === 'wait') particles?.spawn('bubble', b.p.x, surface + 10, 14, { radius: 12, spread: 70, vy: -160 });      // the splash
            if (g.part === 'gone' && b.part === 'rise') particles?.spawn('bubble', g.x, surface + 10, 5, { radius: 8, spread: 40 });      // and out again
            b.part = g.part;
            if (!on) continue;
            b.img.setPosition(g.x, g.y).setRotation(g.angle + this.turn);
            b.fish.setPosition(g.x + Math.cos(g.angle) * G.length * 0.5, g.y + Math.sin(g.angle) * G.length * 0.5).setRotation(g.angle + Math.PI / 2);
            if (g.part === 'plunge' && t > b.bubbleAt) { b.bubbleAt = t + G.bubbleS; particles?.spawn('bubble', g.x, g.y - 20, 1, { radius: 6, spread: 10 }); }
            if (!this.seen && Math.hypot(g.x - fish.x, g.y - fish.y) < G.seen) { this.seen = true; this.onSeen(); }
        }
    }

    destroy() {
        for (const b of this.live?.birds || []) { b.img.destroy(); b.fish.destroy(); }
        this.live = null;
    }
}
