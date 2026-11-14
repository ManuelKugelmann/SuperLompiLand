// Quality tiers and their autotuner (pure, no Phaser): the game keeps at least 30 frames a second
// by turning its expensive looks down a tier when the frame rate stays low, and up again when
// there is room. Each tier is a set of the named shares the layers already read; the scene applies
// them (MainScene.applyQuality).

export const QUALITY = {
    tiers: ['low', 'medium', 'high'],
    // caustics: strength of the net of light on the ground (0 = its shader is not used at all);
    // particles: share of every burst that is spawned; shoals: share of a shoal's fish;
    // simEvery / midEvery: a shoal in sight is simulated every so many frames (near the middle / further out).
    low: { caustics: 0, particles: 0.35, shoals: 0.45, simEvery: 3, midEvery: 5 },
    medium: { caustics: 0.7, particles: 0.6, shoals: 0.7, simEvery: 2, midEvery: 4 },
    high: { caustics: 1, particles: 1, shoals: 1, simEvery: 2, midEvery: 3 },
    tune: {
        windowS: 2,       // the frame rate is the average over this many seconds
        lowFps: 30,       // under this for `lowS` seconds: a tier down
        lowS: 3,
        highFps: 50,      // over this for `highS` seconds: a tier up
        highS: 10,
        settleS: 4,       // after a change nothing is judged for this long (the change itself costs frames)
        regretS: 30,      // a drop this soon after a rise means the higher tier is too much: it is not tried again
        skipMs: 250       // a frame longer than this is a pause (the tab was away), not a slow frame
    }
};

/** The tier to start with: the saved one, else medium on a phone or tablet and high on a desktop. */
export function startTier(saved, mobile, cfg = QUALITY) {
    return cfg.tiers.includes(saved) ? saved : mobile ? 'medium' : 'high';
}

/** `n` things scaled by a tier's share: the whole part, and one more as often as the rest says (`roll` = a random number 0..1). */
export function scaled(n, share, roll) {
    const k = n * share, whole = Math.floor(k);
    return whole + (roll < k - whole ? 1 : 0);
}

/**
 * The autotuner. Returns { tier, fps, step(dtMs) -> the new tier's name when it changed, else null }.
 * It never flips back and forth: after any change it waits, and a tier that had to be left again
 * right after it was tried becomes the ceiling for this run.
 */
export function createAutotune(start, cfg = QUALITY) {
    const T = cfg.tune, frames = [];      // the window: [ms, ...]
    let at = cfg.tiers.indexOf(start), sum = 0, low = 0, high = 0, settle = T.settleS, sinceRise = Infinity, ceiling = cfg.tiers.length - 1;      // settle: the start's own slow frames are not judged either
    if (at < 0) at = cfg.tiers.length - 1;
    const api = {
        get tier() { return cfg.tiers[at]; },
        fps: 60,
        step(dtMs) {
            if (!(dtMs > 0) || dtMs > T.skipMs) return null;
            frames.push(dtMs); sum += dtMs;
            while (sum - frames[0] > T.windowS * 1000) sum -= frames.shift();
            api.fps = frames.length * 1000 / sum;
            const dt = dtMs / 1000;
            sinceRise += dt;
            if (settle > 0) { settle -= dt; low = 0; high = 0; return null; }
            if (sum < T.windowS * 500) return null;      // not enough frames in the window yet
            low = api.fps < T.lowFps ? low + dt : 0;
            high = api.fps > T.highFps ? high + dt : 0;
            if (low >= T.lowS && at > 0) {
                if (sinceRise < T.regretS) ceiling = at - 1;
                at--;
            } else if (high >= T.highS && at < ceiling) {
                at++; sinceRise = 0;
            } else return null;
            low = 0; high = 0; settle = T.settleS; frames.length = 0; sum = 0;
            return api.tier;
        }
    };
    return api;
}
