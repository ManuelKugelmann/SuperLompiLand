import { SIPHON, siphonSpots, stringAt, beadAt, beadGlow } from './siphonophore.js';

/** The reef book's picture of a siphonophore (the string itself is drawn from beads, built only near one). */
export const SIPHON_ART = { siphon_card: 'img/siphon_card.webp' };

export const SIPHON_LOOK = {
    near: 2600, far: 4200,   // px from a spot at which its strings are built, and beyond which they are removed
    depth: 41,               // lights of their own, above the deep's darkness (MainScene ambient, 40)
    bead: 46,                // px across a bead's glow
    tints: [0x9fe8ff, 0xc9b6ff, 0xa8ffd8]   // one colour per string, taken in turn
};

const BEAD = 'siphon_bead';

function ensureTexture(scene) {
    if (scene.textures.exists(BEAD)) return;
    // A soft point of light with a bright core.
    const S = 64, t = scene.textures.createCanvas(BEAD, S, S), c = t.getContext(), g = c.createRadialGradient(S / 2, S / 2, 1, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, S, S);
    t.refresh();
}

/**
 * Draws the siphonophore strings (siphonophore.js): each spot's strings are one batch of little
 * lights, built only near the fish.
 *   create():  this.siphons = new SiphonophoreLayer(scene, routeY, onSeen)
 *   update():  this.siphons.update(fish, t)      // fish = { x, y }, t in s
 */
export default class SiphonophoreLayer {
    constructor(scene, routeY, onSeen) {
        this.scene = scene; this.routeY = routeY; this.onSeen = onSeen;
        this.spots = siphonSpots();
        this.live = new Map();      // spot index -> { blitter, strings: [{ str, routeY, bobs, from, at }] }
        this.seen = false; this.p = {};
    }

    build(spot) {
        const s = this.scene, L = SIPHON_LOOK;
        ensureTexture(s);
        const blitter = s.add.blitter(0, 0, BEAD).setDepth(L.depth).setBlendMode('ADD').setScale(L.bead / 64);
        return { blitter, spot, strings: [] };      // its strings follow one per frame (update): together they were one long frame
    }

    /** The next string of a spot that is being built. */
    addString(live) {
        const k = live.strings.length, str = stringAt(live.spot, k), tint = SIPHON_LOOK.tints[k % SIPHON_LOOK.tints.length];
        live.strings.push({ str, routeY: this.routeY(str.x), bobs: Array.from({ length: SIPHON.beads }, () => live.blitter.create(0, 0).setTint(tint)), from: 0, at: null });
    }

    update(fish, t) {
        const L = SIPHON_LOOK, k = L.bead / 64;
        this.spots.forEach((spot, i) => {
            const d = Math.abs(spot.x - fish.x), live = this.live.get(i);
            if (!live && d < L.near && this.scene.buildSlot()) this.live.set(i, this.build(spot));
            else if (live && d > L.far) { live.blitter.destroy(); this.live.delete(i); }
        });
        for (const [i, live] of this.live) {
            if (live.strings.length < SIPHON.strings && this.scene.buildSlot()) this.addString(live);
            for (const s of live.strings) {
                // The bead nearest the fish, if close enough, starts a wave of light (once it has rested).
                let near = -1, best = SIPHON.wake;
                for (let j = 0; j < s.bobs.length; j++) {
                    const p = beadAt(s.str, j, t, s.routeY, this.p), dist = Math.hypot(p.x - fish.x, p.y - fish.y);
                    if (dist < best) { best = dist; near = j; }
                    const b = s.bobs[j];
                    // The blitter is scaled as a whole: its bobs' places are in its own, unscaled measure.
                    b.x = p.x / k - 32; b.y = p.y / k - 32;
                    b.alpha = beadGlow(j, s.from, s.at === null ? null : t - s.at);
                }
                if (near >= 0 && (s.at === null || t - s.at > SIPHON.rest)) { s.from = near; s.at = t; }
            }
            const spot = this.spots[i];
            if (!this.seen && Math.abs(fish.x - spot.x) < SIPHON.seen) { this.seen = true; this.onSeen(); }
        }
    }

    destroy() {
        for (const live of this.live.values()) live.blitter.destroy();
        this.live.clear();
    }
}
