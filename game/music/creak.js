// Old ship timbers groaning (pure; spec 5.0e, the ghost ship). Stick-slip friction: slips come
// slowly at first and faster as the wood bends; every slip is a short scrape of noise that rings
// three low wooden modes. The intervals jitter, because friction never ticks evenly (an even
// train reads as an electric buzz). Tuned by listening with earshot: a weak match for "a ship
// hull creaking" (z +2.4, rank 8 of 322), 99 % against buzz / frog / engine.

export const CREAK = {
    mode: [170, 280],      // Hz range of the lowest wooden mode (the others at ~2.2x and ~3.8x)
    decay: [0.05, 0.03, 0.018],   // s ring time per mode
    rate: [3, 25],         // slips per second at the start and at the end of a groan
    scrapeS: 0.009         // s of friction noise in each slip
};

/** Mono samples (peak 1) of one groan, `dur` s at sample rate `sr`. */
export function creakSamples(sr, dur, rnd = Math.random, cfg = CREAK) {
    const n = Math.floor(sr * dur), d = new Float32Array(n);
    const m0 = cfg.mode[0] + rnd() * (cfg.mode[1] - cfg.mode[0]);
    const modes = [m0, m0 * (2.1 + rnd() * 0.4), m0 * (3.6 + rnd() * 0.6)], amps = [1, 0.6, 0.35];
    let t = 0.02;
    while (t < dur - 0.05) {
        const u = t / dur, rate = cfg.rate[0] + (cfg.rate[1] - cfg.rate[0]) * u * u;
        const a = Math.sin(Math.PI * u) ** 0.6 * (0.6 + 0.4 * rnd()), i0 = Math.floor(t * sr);
        for (let m = 0; m < 3; m++) {
            const f = modes[m] * (1 + (rnd() - 0.5) * 0.04), tau = cfg.decay[m] * sr, len = Math.floor(tau * 5), ph = rnd() * 6.28;
            for (let i = 0; i < len && i0 + i < n; i++) d[i0 + i] += a * amps[m] * Math.exp(-i / tau) * Math.sin(ph + 2 * Math.PI * f * i / sr);
        }
        const nl = Math.floor(cfg.scrapeS * sr);
        for (let i = 0; i < nl && i0 + i < n; i++) d[i0 + i] += a * 0.5 * (rnd() * 2 - 1) * (1 - i / nl);
        t += (1 / rate) * (0.6 + 0.8 * rnd());
    }
    let pk = 0;
    for (const v of d) pk = Math.max(pk, Math.abs(v));
    if (pk > 0) for (let i = 0; i < n; i++) d[i] /= pk;
    return d;
}
