// Breathing and the "blub": a fish pumps water over its gills by opening and
// closing its mouth in a soft rhythm — slow and sleepy at rest, quick when out
// of breath — and now and then lets a little bubble go.
// Pure and deterministic per seed (tests/breath.test.mjs).

export const BREATH = {
    restHz: 0.55, maxHz: 2.4,     // mouth cycles per second, resting / exhausted
    recover: 0.35,                // how fast the breath calms down again (per second)
    tire: 1.6,                    // how fast exertion drives it up (per second)
    mouthRest: 0.35, mouthMax: 1, // how far the mouth opens per cycle
    blubEvery: [3, 6]             // cycles between two bubbles
};

export class Breath {
    constructor(seed = 1, cfg = BREATH) {
        this.cfg = cfg;
        this.seed = seed >>> 0;
        this.phase = 0;
        this.effort = 0;          // 0 = calm .. 1 = out of breath (smoothed)
        this.mouth = 0;           // 0 = closed .. 1 = wide open
        this.gill = 0;            // gill cover, opens as the mouth closes
        this.blub = false;        // true on the one step a bubble is let go
        this.cycles = 0;
        this.nextBlub = this.pick();
    }

    pick() {
        // Small deterministic step so two fish do not blub in unison.
        this.seed = (Math.imul(this.seed ^ (this.seed >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0;
        const [a, b] = this.cfg.blubEvery;
        return a + (this.seed % (b - a + 1));
    }

    /** @param dt seconds  @param exertion 0..1 how hard the fish is working right now */
    update(dt, exertion = 0) {
        const c = this.cfg;
        const rate = exertion > this.effort ? c.tire : c.recover;
        this.effort += (exertion - this.effort) * (1 - Math.exp(-rate * dt));
        const before = this.phase;
        this.phase += (c.restHz + (c.maxHz - c.restHz) * this.effort) * Math.PI * 2 * dt;
        const open = Math.max(0, Math.sin(this.phase));                         // half the cycle open, half closed
        this.mouth = open * (c.mouthRest + (c.mouthMax - c.mouthRest) * this.effort);
        this.gill = Math.max(0, Math.sin(this.phase - Math.PI * 0.6)) * (0.4 + 0.6 * this.effort);
        // A bubble leaves as the mouth closes, every few cycles.
        this.blub = false;
        if (Math.floor(this.phase / (Math.PI * 2)) > Math.floor(before / (Math.PI * 2))) {
            this.cycles++;
            if (--this.nextBlub <= 0) { this.blub = true; this.nextBlub = this.pick(); }
        }
        return this;
    }
}
