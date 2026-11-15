import { keepOut } from './ai/keepOut.js';
import { belowHud } from './escort.js';
import Phaser from 'phaser';
import { play } from './audio.js';
import { RESCUES, rescueSpots, freesRescue } from './rescues.js';
import BonusCoins from './level/BonusCoins.js';

/**
 * How a trapped animal stands out (tester: rescues should be more noticeable), shared by the small
 * rescues and the chapter's netted friend: a warm pulsing halo that reads from a screen away
 * (colour, brightest alpha, lowest share of it in the pulse) and a dark copy of the net just behind
 * it, so the mesh shows against bright water ([tint, alpha, scale]).
 */
export const RESCUE_HALO = { tint: 0xffb24f, alpha: 0.85, low: 0.55, netShadow: [0x05161c, 0.55, 1.05] };   // a normal blend, not an added light: added light vanishes in bright shallow water

/** The halo picture: full in the middle, fading smoothly to nothing at its rim (baked once). */
export function rescueHalo(scene) {
    if (!scene.textures.exists('rescue_halo')) {
        const N = 127, t = scene.textures.createCanvas('rescue_halo', N, N), c = t.getContext(), g = c.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
        for (let i = 0; i <= 8; i++) { const r = i / 8, a = (1 - r) * (1 - r) * (1 + 2 * r); g.addColorStop(r, `rgba(255,255,255,${a.toFixed(3)})`); }
        c.fillStyle = g; c.fillRect(0, 0, N, N); t.refresh();
    }
    return 'rescue_halo';
}

/** A dark copy of a net picture just behind it (RESCUE_HALO.netShadow): it keeps the net's place and turn through `follow()`. */
export function netShadow(scene, net) {
    const [tint, alpha, k] = RESCUE_HALO.netShadow;
    const sh = scene.add.image(net.x, net.y, net.texture.key).setDepth(net.depth - 0.05).setTint(tint).setAlpha(alpha)
        .setDisplaySize(net.displayWidth * k, net.displayHeight * k);
    sh.follow = () => sh.setPosition(net.x + 2, net.y + 3).setRotation(net.rotation).setVisible(net.active && net.visible);
    return sh;
}

export const RESCUE_LOOK = {
    near: 2600, far: 4200,   // px: a scene is built when the player is this close, removed beyond that
    size: 190,           // px across of the caught animal in its trap, and of the animal once it is free
    net: 250,            // px across of the bit of net around it while its painted trap is missing
    struggle: 9,         // px it wriggles
    wobble: 0.06,        // radians it rocks, about once a second ...
    tug: [14, 2.3],      // ... and every so many seconds (second number) it tugs this many px against its trap
    sunk: 0.3,           // share of its height a trap on the seabed lies sunk in the sand
    callEvery: 1.4,      // s between the bubbles that rise from a trap on the seabed up toward the route
    callNear: 1500,      // px from the fish within which every trapped animal calls: it waves and bubbles rise from its trap
    wave: 0.28, waveS: 0.9,   // radians it rocks when it waves, and s over which that dies down
    trail: 5,            // coins that lead from the route down to a trap on the seabed
    glow: 240,           // px radius of the soft light that shows it from afar
    happyMs: 1500,       // one happy loop where the net was ...
    happyRadius: 90,
    alongMax: 6,         // ... then it swims along with the fish for good (tester: "they follow, then vanish: strange"); only when more than this many follow, the one that has followed longest says goodbye ...
    alongOff: [-150, -110],   // ... the first at this place beside the fish (px behind, px above) ...
    alongStep: [-78, 46],     // ... each further one this much further behind, in turn above and below the line ...
    alongEase: 0.09,     // ... easing there by this share per step (keeps up with a sprinting fish) ...
    alongClear: 36,      // ... and keeping this many px from rock (ai/keepOut.js)
    leaveMs: 1800,       // and fades as it swims off
    big: 1.9             // a big rescue (a turtle in a large ghost net, a landmark) is drawn this much larger
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
        const k = spot.big ? L.big : 1;
        const glow = s.add.image(x, y, rescueHalo(s)).setDisplaySize(L.glow * 2 * k, L.glow * 2 * k).setTint(RESCUE_HALO.tint).setDepth(4.4);
        const key = `rescue_${spot.trap}`, painted = s.textures.exists(key);
        const img = painted ? s.add.image(x, y, key) : s.add.circle(x, y, 40, 0xffb36b);
        img.setDepth(4.5).setScale(L.size * k / Math.max(img.width, img.height));
        // A big rescue hangs in a large ghost net, draped behind the animal.
        const ghost = spot.big && s.textures.exists('hazard_net') ? s.add.image(x, y - L.size * 0.2, 'hazard_net').setDepth(4.45).setAlpha(0.9) : null;
        ghost?.setScale(L.size * k * 1.7 / Math.max(ghost.width, ghost.height));
        const net = painted ? null : s.add.image(x, y, 'beat_net').setDepth(4.6).setDisplaySize(L.net, L.net);
        const shadow = net ? netShadow(s, net) : null;
        // A trap on the seabed lies below the view from the route: a trail of coins leads down to it.
        const n = L.trail, trail = ground === null ? null : new BonusCoins(s, Array.from({ length: n }, (_, i) => ({ x: x - 120 + 120 * i / (n - 1), y: ry + 130 + (y - 260 - ry) * i / (n - 1) })), 2, this.onCoin);
        return { spot, x, y, px: x, py: y, img, glow, net, ghost, shadow, trail, state: 'caught', left: 0, seed: x * 0.013, lying: ground !== null, call: 0 };
    }

    /** The nearest animal still in its trap within calling distance of the fish, or null (for the edge pointer). */
    calling(fish) {
        let best = null, d = RESCUE_LOOK.callNear;
        for (const a of this.actors.values()) if (a.state === 'caught' && Math.abs(a.x - fish.x) < d) { d = Math.abs(a.x - fish.x); best = a; }
        return best;
    }

    remove(a) {
        a.img.destroy(); a.glow.destroy(); a.net?.destroy(); a.ghost?.destroy(); a.shadow?.destroy(); a.trail?.destroy();
        this.actors.delete(a.spot.id);
    }

    free(a) {
        if (a.state !== 'caught') return;
        a.state = 'happy'; a.left = RESCUE_LOOK.happyMs;
        this.done.add(a.spot.id);
        const free = `rescue_${a.spot.trap}_free`;
        if (this.scene.textures.exists(free) && a.img.setTexture) a.img.setTexture(free).setScale(RESCUE_LOOK.size * (a.spot.big ? RESCUE_LOOK.big : 1) / Math.max(a.img.width, a.img.height));
        // The ghost net sinks away slowly: the place is clean again.
        const ghost = a.ghost; a.ghost = null;
        if (ghost) this.scene.tweens.add({ targets: ghost, y: ghost.y + 420, alpha: 0, angle: -25, duration: 2600, ease: 'Sine.easeIn', onComplete: () => ghost.destroy() });
        const net = a.net; a.net = null; a.shadow?.destroy(); a.shadow = null;
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
                // A gentle call when the fish is about (playtest: the animals to rescue should be easier to notice): every so often
                // it waves (a quick wide rocking that dies down) and a few small bubbles rise from its trap. One lying on the sand calls anyway.
                const heard = Math.abs(a.x - fish.x) < L.callNear;
                // Heard for the first time on this approach: a soft "here!" (spec 5.0t 4, rescue calls).
                if (heard && !a.heard) play('call');
                a.heard = heard;
                if ((heard || a.lying) && (a.call -= delta / 1000) <= 0) {
                    a.call = L.callEvery; a.wave = heard ? 1 : 0;
                    s.particles?.mark('bubble', a.x, a.y - L.size * 0.3, heard ? 4 : 2, { radius: 10, spread: 30, vy: -260 });
                }
                a.wave = Math.max(0, (a.wave || 0) - delta / 1000 / L.waveS);
                a.img.setPosition(a.x + wx, a.y + wy).setRotation(Math.sin(t * 6.3 + a.seed) * L.wobble + pull * 0.006 + Math.sin(t * 13) * L.wave * a.wave);
                a.net?.setRotation(Math.sin(t * 1.4 + a.seed) * 0.08);
                a.shadow?.follow();
                a.glow.setAlpha(RESCUE_HALO.alpha * (RESCUE_HALO.low + (1 - RESCUE_HALO.low) * (0.5 + 0.5 * Math.sin(t * 2.2 + a.seed))));
                continue;
            }
            a.left -= delta;
            const fromX = a.px;
            if (a.state === 'happy') {
                const k = (1 - a.left / L.happyMs) * Math.PI * 2;
                a.px = a.x + Math.sin(k) * L.happyRadius; a.py = a.y - (1 - Math.cos(k)) * L.happyRadius * 0.7;
                if (a.left <= 0) { a.state = 'along'; a.left = Infinity; a.joined = this.joined = (this.joined || 0) + 1; }
            } else {
                // Beside the fish, a little behind and above; when its time is up it stays behind and fades.
                const k = 1 - Math.pow(1 - L.alongEase, frames);
                if (a.state === 'along') {
                    // Its place in the line: the newest nearest the fish, older ones further back.
                    const i = this.joined - a.joined;
                    if (i >= L.alongMax) { a.state = 'leave'; a.left = L.leaveMs; continue; }
                    const ox = L.alongOff[0] + L.alongStep[0] * i, oy = L.alongOff[1] + (i % 2 ? L.alongStep[1] : 0);
                    a.px += (fish.x + ox - a.px) * k; a.py += (belowHud(fish.y + oy + Math.sin(t * 2.4 + a.seed) * 18, this.scene.cameras.main.worldView.y) - a.py) * k;      // never over the HUD's band
                    // ... and never in rock (it follows the fish's path, which may cut a corner).
                    if (this.scene.level?.rock) { const q = keepOut(a.px, a.py, L.alongClear, this.scene.level.rock, this.out || (this.out = { x: 0, y: 0 })); a.px = q.x; a.py = q.y; }
                }
                else { a.py -= 1.1 * frames; a.img.setAlpha(Math.max(0, a.left / L.leaveMs)); }
                if (a.left <= 0) {
                    if (a.state === 'leave') { this.remove(a); continue; }
                    a.state = 'leave'; a.left = L.leaveMs;
                }
            }
            if (Math.abs(a.px - fromX) > 0.3 && a.img.setFlipX) a.img.setFlipX(a.px < fromX);
            a.img.setPosition(a.px, a.py).setRotation(Math.sin(t * 6 + a.seed) * 0.06);
            a.glow.setPosition(a.px, a.py).setAlpha(RESCUE_HALO.alpha * 0.35 * (a.state === 'leave' ? Math.max(0, a.left / L.leaveMs) : 1));
        }
    }

    /** The ids freed so far (for the save). */
    toJSON() { return [...this.done]; }
}

export { RESCUES };
