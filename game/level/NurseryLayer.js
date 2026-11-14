import { createRig } from '../CardRig.js';
import { SPECIES, fishTexture } from '../ai/SwarmLayer.js';
import { NURSERY, nurserySpot, fryHome, fryDrift, fryPart, pupAt, pupBeside } from './nursery.js';

export const NURSERY_LOOK = {
    near: 2600, far: 4200,   // px from the nursery at which it is built, and beyond which it is removed
    fryDepth: 3.6,           // with the shoals
    pupDepth: 3.4            // just behind them
};

/** The painted lemon shark pup (loaded by the title screen; part cards in img/parts too). While it is missing, Sharky's own picture stands in, small. */
export const PUP_ART = { lemon_pup: 'img/lemon_pup.webp' };

/**
 * Draws the root nursery (nursery.js): the fry as one batch of little pictures, the two pups on rigs.
 *   create():  this.nursery = new NurseryLayer(scene, routeY, () => playing Sharky?, onSeen)
 *   update():  this.nursery.update(fish, facing, t, dt)      // fish = { x, y }, t and dt in s
 */
export default class NurseryLayer {
    constructor(scene, routeY, isShark, onSeen) {
        this.scene = scene; this.routeY = routeY; this.isShark = isShark; this.onSeen = onSeen;
        this.spot = nurserySpot();
        this.built = null; this.seen = false; this.followed = 0;
        this.a = {}; this.b = {};
    }

    build() {
        const s = this.scene, N = NURSERY, key = fishTexture(s, 'juvenile', SPECIES.juvenile);
        const blitter = s.add.blitter(0, 0, key).setDepth(NURSERY_LOOK.fryDepth);
        const fry = Array.from({ length: N.fry }, (_, i) => ({ home: fryHome(i), bob: blitter.create(0, 0, 1), px: 0, py: 0 }));
        const pupKey = ['lemon_pup', 'player_shark'].find(k => s.textures.exists(k));
        const pups = pupKey ? Array.from({ length: N.pups }, () => ({
            rig: createRig(s, { states: { normal: { key: pupKey, width: N.pupLength, wiggle: 8 } }, anim: 'swim', soft: 0.5, upright: true }, this.spot.x, 0, NURSERY_LOOK.pupDepth),
            x: null, y: 0
        })) : [];
        const frame = blitter.texture.get(1);
        this.built = { blitter, fry, pups, w: frame.width, h: frame.height };
    }

    clear() {
        if (!this.built) return;
        this.built.blitter.destroy();
        for (const p of this.built.pups) p.rig.destroy();
        this.built = null;
    }

    update(fish, facing, t, dt) {
        const d = Math.abs(fish.x - this.spot.x);
        if (this.built && d > NURSERY_LOOK.far) this.clear();
        if (!this.built) {
            if (d > NURSERY_LOOK.near || !this.scene.buildSlot()) return;
            this.build();
        }
        const N = NURSERY, B = this.built, cx = this.spot.x, cy = this.routeY(cx) - N.above;
        // The fry: each round its own place, out of the fish's way quickly and back slowly.
        for (let i = 0; i < B.fry.length; i++) {
            const f = B.fry[i], hx = cx + f.home.x, hy = cy + f.home.y, part = fryPart(hx, hy, fish.x, fish.y, this.a), drift = fryDrift(i, t, this.b);
            const away = Math.hypot(part.x, part.y) > Math.hypot(f.px, f.py), k = Math.min(1, dt / (away ? N.partS : N.closeS));
            f.px += (part.x - f.px) * k; f.py += (part.y - f.py) * k;
            const x = hx + drift.x + f.px;
            f.bob.flipX = x < (f.lastX ?? x) - 0.01 ? true : x > (f.lastX ?? x) + 0.01 ? false : f.bob.flipX;
            f.lastX = x;
            f.bob.x = x - B.w / 2; f.bob.y = hy + drift.y + f.py - B.h / 2;
            f.bob.setFrame(Math.sin(t * 9 + i) < -0.33 ? 0 : Math.sin(t * 9 + i) > 0.33 ? 2 : 1);
        }
        // The pups: their slow round under the cloud; with Sharky near, they swim along with him for a while.
        const near = this.isShark() && B.pups.some(p => p.x !== null && Math.hypot(p.x - fish.x, p.y - fish.y) < N.follow.near);
        if (near && this.followed < N.follow.s) this.followed += dt;
        else if (!near) this.followed = 0;
        const along = near && this.followed < N.follow.s;
        B.pups.forEach((p, k) => {
            const to = along ? pupBeside(k, fish.x, fish.y, facing, this.a) : pupAt(k, t, cx, cy + N.below, this.a);
            if (p.x === null) { p.x = to.x; p.y = to.y; }
            const e = Math.min(1, dt / N.follow.catchS), nx = p.x + (to.x - p.x) * e, ny = p.y + (to.y - p.y) * e;
            const vx = (nx - p.x) / Math.max(dt, 1e-3) / 60;
            p.rig.draw({ x: nx, y: ny, vx, vy: 0, frames: dt * 60, effort: 0.25, facing: Math.abs(vx) < 0.05 ? (p.dir || 1) : (p.dir = vx < 0 ? -1 : 1), turn: 0.05 });
            p.x = nx; p.y = ny;
        });
        if (!this.seen && Math.hypot(fish.x - cx, fish.y - cy) < N.seen) { this.seen = true; this.onSeen(); }
    }

    destroy() { this.clear(); }
}
