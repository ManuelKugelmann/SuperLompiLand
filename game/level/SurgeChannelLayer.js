import { SURGE_CHANNEL, channelSpot, swell, channelFlow } from './surgeChannel.js';

/**
 * The surge channel's look and feel (surgeChannel.js): specks of drifting matter that ride the
 * swell show the water's motion; the kelp's lean and the pull itself come from the same swell
 * (LevelGenerator.lean, MainScene.waterAt).
 *   create():  this.surgeChannel = new SurgeChannelLayer(scene, routeY, onSeen)
 *   update():  this.surgeChannel.update(fish, t, delta)      // fish = { x, y }, t in s, delta in ms
 *   water:     if (this.surgeChannel.live) this.surgeChannel.flowAt(x, y, t, out)
 */
export default class SurgeChannelLayer {
    constructor(scene, routeY, onSeen) {
        this.scene = scene; this.routeY = routeY; this.onSeen = onSeen;
        this.spot = channelSpot();
        this.live = false;      // the fish is near enough for the surge to matter
        this.seen = false; this.speckIn = 0;
    }

    /** The surge's pull at (x, y), into `out` (px/step). */
    flowAt(x, y, t, out) {
        return channelFlow(x, y, t, this.routeY(x), out);
    }

    update(fish, t, delta) {
        const C = SURGE_CHANNEL, s = this.spot, W = this.scene.scale.width;
        this.live = fish.x > s.x0 - W && fish.x < s.x1 + W;
        if (!this.live) return;
        // Specks that ride the swell: set down in the view, inside the channel, they drift with the water.
        this.speckIn -= delta;
        if (this.speckIn <= 0) {
            this.speckIn = C.streakMs;
            const x = fish.x + (Math.random() - 0.5) * W * 1.2;
            if (x > s.x0 && x < s.x1) {
                const y = this.routeY(x) + (Math.random() - 0.5) * C.half * 1.4, w = swell(t);
                this.scene.particles?.spawn('bubble', x, y, 1, { radius: 5, spread: 6, vx: w * 260, vy: 0 });
            }
        }
        if (!this.seen && Math.abs(fish.x - s.x) < C.seen) { this.seen = true; this.onSeen(); }
    }
}
