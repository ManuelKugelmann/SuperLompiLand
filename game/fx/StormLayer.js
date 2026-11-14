import { WEATHER, stormShare, downwelling } from '../level/weather.js';

export const STORM_LOOK = {
    sky: 0.6,          // how dark the sky gets in the middle of the storm
    gloom: 0.3,        // how much darker the water gets under it
    rain: 46,          // rain streaks
    rainSpeed: 1500,   // px per second
    slant: 0.35,       // the rain falls this much sideways (the wind blows west)
    bubbleMs: 70,      // one burst of bubbles in each column of the downwelling this often
    bubbleSpeed: 420   // px per second they stream down (or up)
};

/**
 * What the open sea's two exceptions look like (level/weather.js is the rule). Storm: the sky
 * darkens, the water under it turns gloomy and rain slants down above the waterline, all
 * building up from the storm's edge, so it is seen long before it is felt. Downwelling:
 * bubbles stream down the one column and up the other.
 */
export default class StormLayer {
    constructor(scene) {
        this.scene = scene;
        const W = scene.scale.width, H = scene.scale.height;
        // Behind the waterline: over the sky, clouds and horizon, under the sea's top edge.
        this.sky = scene.add.rectangle(0, 0, W, H, 0x1c2733, 0).setOrigin(0).setScrollFactor(0).setDepth(-28.3).setVisible(false);
        // In front of the world: the light goes out of the water too.
        this.gloom = scene.add.rectangle(0, 0, W, H, 0x0e1a26, 0).setOrigin(0).setScrollFactor(0).setDepth(6.5).setVisible(false);
        this.rain = Array.from({ length: STORM_LOOK.rain }, (_, i) => {
            const r = scene.add.rectangle(0, 0, 3, 46 + (i % 3) * 18, 0xdbe8f2, 0.5).setScrollFactor(0, 1).setDepth(-28.2).setVisible(false)
                .setRotation(STORM_LOOK.slant);
            r.sx = ((i * 0.6180339) % 1) * (W + 300); r.fall = ((i * 0.3819) % 1);
            return r;
        });
        this.cols = downwelling();
        this.nextBubbles = 0;
    }

    /** Per frame; `camX`, `camY` = the camera's top left in the world, `particles` = the scene's particle layer. */
    update(camX, camY, t, delta, particles) {
        const W = this.scene.scale.width, H = this.scene.scale.height, k = stormShare(camX + W / 2);
        const on = k > 0.01;
        this.sky.setVisible(on).setAlpha(STORM_LOOK.sky * k);
        this.gloom.setVisible(on).setAlpha(STORM_LOOK.gloom * k);
        const wet = on && camY < 60;      // rain only where the sky is in view
        for (const r of this.rain) {
            r.setVisible(wet);
            if (!wet) continue;
            r.fall = (r.fall + STORM_LOOK.rainSpeed * delta / 1000 / 1100) % 1;
            // From high above the view down to the waterline, drifting west as it falls.
            r.setPosition(((r.sx - r.fall * 1100 * STORM_LOOK.slant) % (W + 300) + W + 300) % (W + 300) - 150, -1100 + r.fall * 1100).setAlpha(0.55 * k);
        }

        // The downwelling: bubbles run down the one column and up the other, wherever they are in view.
        this.nextBubbles -= delta;
        if (this.nextBubbles > 0) return;
        this.nextBubbles = STORM_LOOK.bubbleMs;
        const d = WEATHER.down;
        for (const [x, dir] of [[this.cols.down, 1], [this.cols.up, -1]]) {
            if (x < camX - d.halfWidth || x > camX + W + d.halfWidth) continue;
            const y0 = Math.max(d.top, camY - 100), y1 = Math.min(d.routeY + 250, camY + H + 100);
            if (y1 <= y0) continue;
            const y = y0 + ((t * 7.3 + x) % 1) * (y1 - y0);
            particles.spawn('bubble', x + Math.sin(t * 5 + y) * d.halfWidth * 0.6, y, 2, { radius: 12, spread: 40, vy: dir * STORM_LOOK.bubbleSpeed });
        }
    }
}
