import Phaser from 'phaser';
import { RESCUES, rescueSpots, freesRescue } from './rescues.js';
import BonusCoins from './level/BonusCoins.js';

export const RESCUE_LOOK = {
    near: 2600, far: 4200,   // px: a scene is built when the player is this close, removed beyond that
    size: 190,           // px across of the caught animal in its trap, and of the animal once it is free
    net: 250,            // px across of the bit of net around it while its painted trap is missing
    struggle: 9,         // px it wriggles
    wobble: 0.06,        // radians it rocks, about once a second ...
    tug: [14, 2.3],      // ... and every so many seconds (second number) it tugs this many px against its trap
    sunk: 0.3,           // share of its height a trap on the seabed lies sunk in the sand
    callEvery: 1.4,      // s between the bubbles that rise from a trap on the seabed up toward the route
    trail: 5,            // coins that lead from the route down to a trap on the seabed
    glow: 240,           // px radius of the soft light that shows it from afar
    glowAlpha: 0.28,
    happyMs: 1500,       // one happy loop where the net was ...
    happyRadius: 90,
    alongMs: 9000,       // ... then it swims along with the fish this long ...
    alongOff: [-150, -110],   // ... at this place beside it (px behind, px above) ...
    alongEase: 0.05,     // ... easing there by this share per step
    leaveMs: 1800        // and fades as it swims off
};

/**
 * The small rescues in the world (rescues.js says where and who): the animal in its bit of net,
 * its happy loop, and its swim alongside the fish. Scenes are built only near the player.
 * `onFree(spot, x, y)` is called once per rescue, `onCoin(x, y)` for every coin of a trail taken.
 */
/** Painted scenes (loaded by the title screen): the animal in its trap, and free. While missing: a plain shape in a bit of net. */
export const RESCUE_ART = Object.fromEntries(RESCUES.traps.flatMap(t => [[`rescue_${t.trap}`, `img/rescue/rescue_${t.trap}.webp`], [`rescue_${t.trap}_free`, `img/rescue/rescue_${t.trap}_free.webp`]]));

export default class RescueLayer {
    /** `routeY(x)` = depth of the calm route; `groundY(x, y)` = the seabed straight below (x, y) or null; `done` = ids already freed in this save. */
    constructor(scene, routeY, groundY, done, onFree, onCoin) {
        this.scene = scene; this.routeY = routeY; this.groundY = groundY; this.onCoin = onCoin; this.done = new Set(done); this.onFree = onFree;
        this.spots = rescueSpots();
        this.actors = new Map();   // spot id -> actor
    }

    build(spot) {
        const s = this.scene, L = RESCUE_LOOK, x = spot.x, ry = this.routeY(x), ground = spot.ground ? this.groundY(x, ry) : null;
        const y = ground === null ? ry : ground - L.size * (0.5 - L.sunk) * 0.6;
        const glow = s.add.image(x, y, 'bd_glow').setDisplaySize(L.glow * 2, L.glow * 2).setTint(0xfff3b0).setDepth(4.4).setBlendMode(Phaser.BlendModes.ADD);
        const key = `rescue_${spot.trap}`, painted = s.textures.exists(key);
        const img = painted ? s.add.image(x, y, key) : s.add.circle(x, y, 40, 0xffb36b);
        img.setDepth(4.5).setScale(L.size / Math.max(img.width, img.height));
        const net = painted ? null : s.add.image(x, y, 'beat_net').setDepth(4.6).setDisplaySize(L.net, L.net);
        // A trap on the seabed lies below the view from the route: a trail of coins leads down to it.
        const n = L.trail, trail = ground === null ? null : new BonusCoins(s, Array.from({ length: n }, (_, i) => ({ x: x - 120 + 120 * i / (n - 1), y: ry + 130 + (y - 260 - ry) * i / (n - 1) })), 2, this.onCoin);
        return { spot, x, y, px: x, py: y, img, glow, net, trail, state: 'caught', left: 0, seed: x * 0.013, lying: ground !== null, call: 0 };
    }

    remove(a) {
        a.img.destroy(); a.glow.destroy(); a.net?.destroy(); a.trail?.destroy();
        this.actors.delete(a.spot.id);
    }

    free(a) {
        if (a.state !== 'caught') return;
        a.state = 'happy'; a.left = RESCUE_LOOK.happyMs;
        this.done.add(a.spot.id);
        const free = `rescue_${a.spot.trap}_free`;
        if (this.scene.textures.exists(free) && a.img.setTexture) a.img.setTexture(free).setScale(RESCUE_LOOK.size / Math.max(a.img.width, a.img.height));
        const net = a.net; a.net = null;
        if (net) this.scene.tweens.add({ targets: net, y: net.y + 200, angle: 70, alpha: 0, scale: net.scale * 0.6, duration: 800, ease: 'Sine.easeIn', onComplete: () => net.destroy() });
        this.onFree(a.spot, a.x, a.y);
    }

    /** A special went off at (x, y). */
    special(x, y) {
        for (const a of this.actors.values()) if (freesRescue(a.x, a.y, x, y, true)) this.free(a);
    }

    /** Per frame. `fish` = { x, y }, `radius` its radius, `t` s, `delta` ms. */
    update(fish, radius, t, delta) {
        const L = RESCUE_LOOK, s = this.scene, frames = delta / (1000 / 60);
        for (const spot of this.spots) {
            if (spot.x < fish.x - L.near) continue;
            if (spot.x > fish.x + L.near) break;
            if (!this.actors.has(spot.id) && !this.done.has(spot.id) && this.scene.buildSlot()) this.actors.set(spot.id, this.build(spot));
        }
        for (const a of this.actors.values()) {
            a.trail?.update(fish, radius, t);
            if (a.state === 'caught') {
                if (Math.abs(a.x - fish.x) > L.far) { this.remove(a); continue; }
                if (freesRescue(a.x, a.y, fish.x, fish.y)) { this.free(a); continue; }
                // It struggles: a steady rocking, and now and then a tug against the trap. One lying on the sand only rocks.
                const pull = Math.max(0, Math.sin((t + a.seed) * Math.PI * 2 / L.tug[1])) ** 8 * L.tug[0];
                const wx = a.lying ? pull * 0.4 : Math.sin(t * 9 + a.seed) * L.struggle + pull, wy = a.lying ? 0 : Math.cos(t * 7 + a.seed) * L.struggle * 0.6;
                a.img.setPosition(a.x + wx, a.y + wy).setRotation(Math.sin(t * 6.3 + a.seed) * L.wobble + pull * 0.006);
                if (a.lying && (a.call -= delta / 1000) <= 0) { a.call = L.callEvery; s.particles?.spawn('bubble', a.x, a.y - L.size * 0.3, 2, { radius: 10, spread: 30, vy: -260 }); }
                a.net?.setRotation(Math.sin(t * 1.4 + a.seed) * 0.08);
                a.glow.setAlpha(L.glowAlpha * (0.7 + 0.3 * Math.sin(t * 2.2 + a.seed)));
                continue;
            }
            a.left -= delta;
            const fromX = a.px;
            if (a.state === 'happy') {
                const k = (1 - a.left / L.happyMs) * Math.PI * 2;
                a.px = a.x + Math.sin(k) * L.happyRadius; a.py = a.y - (1 - Math.cos(k)) * L.happyRadius * 0.7;
                if (a.left <= 0) { a.state = 'along'; a.left = L.alongMs; }
            } else {
                // Beside the fish, a little behind and above; when its time is up it stays behind and fades.
                const k = 1 - Math.pow(1 - L.alongEase, frames);
                if (a.state === 'along') { a.px += (fish.x + L.alongOff[0] - a.px) * k; a.py += (fish.y + L.alongOff[1] + Math.sin(t * 2.4 + a.seed) * 18 - a.py) * k; }
                else { a.py -= 1.1 * frames; a.img.setAlpha(Math.max(0, a.left / L.leaveMs)); }
                if (a.left <= 0) {
                    if (a.state === 'leave') { this.remove(a); continue; }
                    a.state = 'leave'; a.left = L.leaveMs;
                }
            }
            if (Math.abs(a.px - fromX) > 0.3 && a.img.setFlipX) a.img.setFlipX(a.px < fromX);
            a.img.setPosition(a.px, a.py).setRotation(Math.sin(t * 6 + a.seed) * 0.06);
            a.glow.setPosition(a.px, a.py).setAlpha(L.glowAlpha * 0.5 * (a.state === 'leave' ? Math.max(0, a.left / L.leaveMs) : 1));
        }
    }

    /** The ids freed so far (for the save). */
    toJSON() { return [...this.done]; }
}

export { RESCUES };
