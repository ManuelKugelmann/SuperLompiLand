import { spotsOf } from './worldMap.js';
import { mixColor, waterHue } from './biomes.js';
import { due, everyOf } from '../throttle.js';
import BonusCoins from './BonusCoins.js';
import { createRig } from '../CardRig.js';

// What fills the journey's rhythm (worldMap.js decides where; spec 5.0l): small coin figures on
// the route, huge coral colonies behind the lane along the islands, and adult sharks passing
// calmly out at sea. All three are built only near the fish and are pictures: nothing to bump into.

export const RHYTHM_LOOK = {
    near: 3000, far: 4800,   // px from a spot at which its picture is built, and beyond which it is removed
    lompi: 170,          // px: the fish's own length, the measure for "huge"
    treat: { coins: 5, half: 240, rise: 120, depth: 2.6 },      // a coin figure: coins, px to either side of its spot, px it swings up or down
    colony: { scale: [4, 8], depth: -4, tint: 0xa9c6cc, seen: 900 },   // lengths of the fish it is tall; behind the play plane, a little hazy
    // An adult shark is seen at a distance (spec 5.0l): lengths of Sharky it is long (small for what it is: it is far away);
    // px it cruises to either side; px under the route (whole in the picture when the fish swims the lane, never beside it);
    // faded into the water; how fast it comes and goes; `far` = how much of the camera's travel it follows
    // (it drifts past slower than the play plane, like everything distant); px at which it goes into the reef book.
    shark: { scale: [1.6, 2.1], sharky: 250, roam: 1500, below: 380, depth: -5, alpha: 0.32, pace: 0.045, far: 0.3, seen: 1300, edge: 0.3, haze: 0.55, settle: 0.02, groundReach: 4000 }      // edge: its length times this stays clear of the view's bottom edge and of the ground (never cut, never hidden); settle: share of the way to its depth per frame; groundReach: px down from the route the ground is looked for
};

/** The painted big corals (loaded by the title screen): a table, a brain, a fan and a staghorn thicket. While one is missing, one of the reef's own corals stands in, grown huge. */
export const COLONY_KINDS = ['coral_table', 'coral_brain', 'coral_fan', 'coral_staghorn'];
export const COLONY_ART = Object.fromEntries(COLONY_KINDS.map(k => [k, `img/coral/${k}.webp`]));
/** The painted adult grey reef shark (part cards in img/parts too; loaded by the title screen). */
export const SHARK_ART = { adult_shark: 'img/adult_shark.webp' };

const hash = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
const pick = (r, h) => r[0] + (r[1] - r[0]) * h;
/** The first of `keys` that is loaded. */
const have = (scene, keys) => keys.find(k => scene.textures.exists(k));

/** The three coin figures, taken in turn: an arc over the route, a wave along it, a slope up. `u` = 0..1 along the figure; returns px above (-) or below (+) the route. */
export const TREAT_SHAPES = [u => -Math.sin(Math.PI * u), u => Math.sin(2 * Math.PI * u) * 0.6, u => 0.5 - u];

/** The coins of the figure at world x: [{ x, y }]. `routeY(x)` = depth of the calm route. */
export function treatCoins(index, x, routeY, cfg = RHYTHM_LOOK.treat) {
    const shape = TREAT_SHAPES[index % TREAT_SHAPES.length];
    return Array.from({ length: cfg.coins }, (_, k) => {
        const u = k / (cfg.coins - 1), cx = x - cfg.half + u * cfg.half * 2;
        return { x: cx, y: routeY(cx) + shape(u) * cfg.rise };
    });
}

/**
 * Whether a coin figure has a coin within `gap` px of (x, y): `spots` = the figures' places
 * ([{ x0 }], west to east), `routeY(x)` = depth of the calm route. For the chunks' own coin
 * trails, which give way to a figure (two coins on one spot read as a glitch).
 */
export function treatCoinNear(x, y, gap, spots, routeY, cfg = RHYTHM_LOOK.treat) {
    for (let i = 0; i < spots.length; i++) {
        if (Math.abs(spots[i].x0 - x) > cfg.half + gap) continue;
        for (const c of treatCoins(i, spots[i].x0, routeY, cfg)) if (Math.abs(c.x - x) < gap && Math.abs(c.y - y) < gap) return true;
    }
    return false;
}

export default class RhythmLayer {
    /** `routeY(x)` = depth of the calm route; `groundY(x)` = the seabed under it or null; `onCoin(x, y)`; `onSeen(id)` = a reef-book entry was met. */
    constructor(scene, routeY, groundY, onCoin, onSeen) {
        this.scene = scene; this.routeY = routeY; this.groundY = groundY; this.onCoin = onCoin; this.onSeen = onSeen;
        this.kinds = {
            treat: { spots: spotsOf('treat'), live: new Map(), make: (s, i) => this.makeTreat(s, i) },
            colony: { spots: spotsOf('colony'), live: new Map(), make: (s, i) => this.makeColony(s, i) },
            bigshark: { spots: spotsOf('bigshark'), live: new Map(), make: (s, i) => this.makeShark(s, i) }
        };
        this.taken = new Set();      // coins taken stay gone for this run ("treat index:coin number")
        this.seen = new Set();
    }

    makeTreat(spot, i) {
        const left = treatCoins(i, spot.x0, this.routeY).map((p, k) => ({ ...p, k })).filter(p => !this.taken.has(`${i}:${p.k}`));
        const coins = new BonusCoins(this.scene, left, RHYTHM_LOOK.treat.depth, (x, y) => { const p = left.find(q => q.x === x && q.y === y); if (p) this.taken.add(`${i}:${p.k}`); this.onCoin(x, y); });
        return { coins, destroy: () => coins.destroy() };
    }

    makeColony(spot, i) {
        const s = this.scene, L = RHYTHM_LOOK, x = spot.x0, ry = this.routeY(x);
        const key = have(s, [COLONY_KINDS[i % COLONY_KINDS.length], `coral_${1 + i % 5}`, 'coral_1']);
        if (!key) return { destroy() {} };
        const img = s.add.image(x, this.groundY(x) ?? ry + 800, key).setOrigin(0.5, 0.97).setDepth(L.colony.depth).setTint(L.colony.tint).setFlipX(hash(i, 2) < 0.5);
        img.setScale(L.lompi * pick(L.colony.scale, hash(i, 1)) / Math.max(img.width, img.height));      // its longer side is 4 to 8 fish long
        return { img, book: 'coral_colony', seen: L.colony.seen, destroy: () => img.destroy() };
    }

    makeShark(spot, i) {
        const s = this.scene, L = RHYTHM_LOOK.shark, key = have(s, ['adult_shark', 'player_shark']);
        if (!key) return { destroy() {} };
        // The painted shark swims (its part rig bends tail and fins); `img` only says where it is.
        const width = L.sharky * pick(L.scale, hash(i, 3));
        const rig = createRig(s, { states: { normal: { key, width, wiggle: 8 } }, anim: 'swim', soft: 0.5, upright: true }, spot.x0, 0, L.depth).setAlpha(L.alpha).setTint(mixColor(0xffffff, waterHue(spot.x0), L.haze));
        return { img: { x: spot.x0, y: 0 }, rig, width, book: 'adult_shark', seen: L.seen, phase: hash(i, 4) * 6.283, home: spot.x0, cruise: true, turn: i, ground: Infinity, destroy: () => rig.destroy() };
    }

    /** Per frame. `fish` = { x, y }, `radius` its radius, `t` s. */
    update(fish, radius, t) {
        const L = RHYTHM_LOOK, frames = Math.min(3, (t - (this.t ?? t)) * 60);
        this.t = t;
        for (const kind of Object.values(this.kinds)) {
            kind.spots.forEach((spot, i) => {
                const d = Math.abs(spot.x0 - fish.x), live = kind.live.get(i);
                if (!live && d < L.near && this.scene.buildSlot()) kind.live.set(i, kind.make(spot, i));
                else if (live && d > L.far) { live.destroy(); kind.live.delete(i); }
            });
            for (const o of kind.live.values()) {
                o.coins?.update(fish, radius, t);
                if (o.cruise) {
                    // It comes and goes along its stretch, far under the route and the swimmer, turning round slowly at the ends.
                    const S = L.shark, a = t * S.pace + o.phase, x = o.home + Math.sin(a) * S.roam, dir = Math.cos(a) >= 0 ? 1 : -1;
                    // Drawn shifted toward the fish by `far` of the way: against the scrolling picture it moves like something far off.
                    o.img.x = x + (fish.x - x) * S.far;
                    // Its depth changes slowly (it glides, it does not bob): well below the swimmer, clear of the view's bottom edge and of the ground under it.
                    if (due(this.scene.game.loop.frame, everyOf('sample', this.scene.quality?.tier), o.turn)) o.ground = this.scene.level.groundBelow(o.img.x, this.routeY(o.img.x), S.groundReach)?.y ?? Infinity;
                    const want = Math.max(this.routeY(x), fish.y) + S.below, lowest = Math.min(this.scene.cameras.main.worldView.bottom, o.ground) - o.width * S.edge;
                    o.img.y = Math.min(o.img.y ? o.img.y + (want - o.img.y) * Math.min(1, S.settle * frames) : want, lowest);
                    o.rig.draw({ x: o.img.x, y: o.img.y, vx: Math.cos(a) * S.roam * S.pace / 60, vy: 0, frames, effort: 0.25, facing: dir, turn: 0.02 });
                }
                if (o.book && !this.seen.has(o.book) && Math.hypot(o.img.x - fish.x, o.img.y - fish.y) < o.seen) { this.seen.add(o.book); this.onSeen(o.book); }
            }
        }
    }
}
