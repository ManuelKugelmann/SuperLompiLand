import Phaser from 'phaser';
import Rig from './Rig.js';
import { JOURNEY } from './journey.js';

export const BEATS = {
    netSize: 1.5,       // the net, in sizes of the friend caught in it
    struggle: 9,        // px the caught friend wriggles
    glow: 230,          // px radius of the soft light that makes the scene readable from afar
    happyMs: 3600,      // how long a freed friend dances around its spot ...
    happyRadius: 120,   // ... on a circle this big
    leaveMs: 2600,      // then it swims on east and fades
    leaveSpeed: 7       // px per step
};

const NET_KEY = 'beat_net';

/** The ghost net as a picture: a sagging mesh of old rope (fallback art, drawn once). */
function ensureNet(scene) {
    if (scene.textures.exists(NET_KEY)) return;
    const S = 256, c = S / 2, g = scene.make.graphics({ add: false });
    g.lineStyle(5, 0xb9a27a, 0.95);
    for (let i = -5; i <= 5; i++) {
        const o = i * 22, half = Math.sqrt(Math.max(0, 118 * 118 - o * o));
        g.lineBetween(c + o - half * 0.35, c - half, c + o + half * 0.35, c + half);
        g.lineBetween(c - half, c + o + half * 0.3, c + half, c + o - half * 0.3);
    }
    g.lineStyle(8, 0x8f7a55, 1).strokeCircle(c, c, 118);
    g.fillStyle(0xe8dcc0, 1);
    for (let i = 0; i < 10; i++) g.fillCircle(c + Math.cos(i * 0.628) * 118, c + Math.sin(i * 0.628) * 118, 7);   // floats on the rim
    g.generateTexture(NET_KEY, S, S);
    g.destroy();
}

/**
 * The events of the story path in the world: in each chapter a friend hangs in a ghost net on
 * the calm route until Lompi swims up (or uses a special nearby); then the net falls away and
 * the friend dances, thanks and swims on. Scenes are built only near the player.
 */
export default class StoryBeats {
    /** `routeY(x)` = depth of the calm route; `onFree(chapter, x, y)` is called once per rescue. */
    constructor(scene, journey, routeY, onFree) {
        this.scene = scene; this.journey = journey; this.routeY = routeY; this.onFree = onFree;
        this.actors = new Map();   // chapter id -> actor
        ensureNet(scene);
    }

    build(ch) {
        const s = this.scene, x = ch.x, y = this.routeY(x), size = ch.friend.states.normal.width;
        const rig = new Rig(s, ch.friend, x, y, 4.5);
        const glow = s.add.circle(x, y, BEATS.glow, 0xfff3b0, 0.14).setDepth(4.4).setBlendMode(Phaser.BlendModes.ADD);
        const net = s.add.image(x, y, NET_KEY).setDepth(4.6).setDisplaySize(size * BEATS.netSize, size * BEATS.netSize);
        return { ch, x, y, rig, glow, net, state: 'caught', left: 0, seed: x * 0.01 };
    }

    remove(a) {
        a.rig.destroy(); a.glow.destroy(); a.net?.destroy();
        this.actors.delete(a.ch.id);
    }

    free(a) {
        if (a.state !== 'caught' || !this.journey.free(a.ch.friend.id)) return;
        a.state = 'happy'; a.left = BEATS.happyMs;
        const net = a.net; a.net = null;
        this.scene.tweens.add({ targets: net, y: net.y + 260, angle: 70, alpha: 0, scale: net.scale * 0.6, duration: 900, ease: 'Sine.easeIn', onComplete: () => net.destroy() });
        this.onFree(a.ch, a.x, a.y);
    }

    /** A special went off at (x, y): it tears a net nearby. */
    special(x, y) {
        for (const a of this.actors.values()) if (Math.hypot(a.x - x, a.y - y) < JOURNEY.specialRadius) this.free(a);
    }

    /** Per frame. `fish` = { x, y }, `t` s, `delta` ms. */
    update(fish, t, delta) {
        const frames = delta / (1000 / 60);
        for (const ch of this.journey.list) {
            if (!ch.friend || this.actors.has(ch.id) || this.journey.has(ch.friend.id)) continue;
            if (Math.abs(ch.x - fish.x) < JOURNEY.near) this.actors.set(ch.id, this.build(ch));
        }
        for (const a of this.actors.values()) {
            if (a.state === 'caught') {
                if (Math.abs(a.x - fish.x) > JOURNEY.far) { this.remove(a); continue; }
                if (Math.hypot(a.x - fish.x, a.y - fish.y) < JOURNEY.freeRadius) { this.free(a); continue; }
                // It wriggles in the net and looks toward whoever comes.
                const wx = Math.sin(t * 9 + a.seed) * BEATS.struggle, wy = Math.cos(t * 7 + a.seed) * BEATS.struggle * 0.6;
                a.rig.draw({ x: a.x + wx, y: a.y + wy, frames, effort: 0.8, facing: fish.x < a.x ? -1 : 1 });
                a.net.setPosition(a.x + wx * 0.5, a.y + wy * 0.5).setRotation(Math.sin(t * 1.4 + a.seed) * 0.08);
                a.glow.setAlpha(0.1 + 0.06 * Math.sin(t * 2.2));
                continue;
            }
            a.left -= delta;
            if (a.state === 'happy') {
                // A dance of joy: round and round where the net was.
                const k = t * 4.2, r = BEATS.happyRadius;
                a.px = a.x + Math.cos(k) * r; a.py = a.y + Math.sin(k) * r * 0.7;
                a.rig.draw({ x: a.px, y: a.py, vx: -Math.sin(k) * 8, vy: Math.cos(k) * 5.6, frames, effort: 1 });
                if (a.left <= 0) { a.state = 'leave'; a.left = BEATS.leaveMs; }
            } else {
                a.px += BEATS.leaveSpeed * frames; a.py -= 1.2 * frames;
                a.rig.setAlpha(Math.max(0, a.left / BEATS.leaveMs));
                a.rig.draw({ x: a.px, y: a.py, vx: BEATS.leaveSpeed, vy: -1.2, frames, effort: 0.9 });
                if (a.left <= 0) { this.remove(a); continue; }
            }
            a.glow.setPosition(a.px, a.py).setAlpha(0.12);
        }
    }

    destroy() {
        for (const a of [...this.actors.values()]) this.remove(a);
    }
}
