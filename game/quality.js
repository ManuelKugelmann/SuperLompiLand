// Quality tiers and their autotuner (pure, no Phaser): the game keeps at least 30 frames a second
// by turning its expensive looks down a tier when the frame rate stays low, and up again when
// there is room. Each tier is a set of the named shares the layers already read; the scene applies
// them (MainScene.applyQuality).

export const QUALITY = {
    tiers: ['basic', 'low', 'medium', 'high'],      // basic: for phones many times slower than a good one (playtest: "some mobiles might be 100x slower")
    // caustics: strength of the net of light on the ground (0 = its shader is not used at all);
    // particles: share of every burst that is spawned; shoals: share of a shoal's fish;
    // simEvery / midEvery: a shoal in sight is simulated every so many frames (near the middle / further out);
    // glow: share of the soft glow pictures that are drawn (fish light, deep glow, coin glows); far: share of the far scenery's single objects.
    // shoalsAround: how many roaming shoals are kept about the view; sheen: the friends' rainbow sheen (0 = off: one additive picture and one batch break less per friend);
    // poseEvery: a creature's rig is posed anew every so many frames (rig/cards.js CARDS.poseEvery);
    // animEvery: a swaying plant is bent anew every so many frames (staggered; those behind the play plane half as often);
    // kelpBack: share of the hazy second kelp stalks behind the play plane; plantSegments: points of a swaying plant's strip;
    // lead: chunks the world is made ahead of a fast view at most (each chunk brings its plants, props and creatures: a slow phone gets fewer);
    // liteTerrain: the landscape's lighter shader (fx/TerrainPipeline.js TERRAIN_LITE);
    // resolution: share of the game's px the picture is drawn at, each way (renderScale.js): the graphics chip's work goes with its square.
    // eyes: px from the view's middle within which rigs show living eyes (beyond: the painted eye); lids: 1 = blinking lids, 0 = the eye's white squeezes shut instead.
    // micro: share of the small ground scatter (pebbles, shells, mussels, tufts, rubble) placed per chunk.
    // pairs: 1 = kinds that live in pairs come two by two (0: one alone; the mate is its chunk's last friend, so the others keep their numbers).
    // grade: 1 = the camera's colour grade as a post effect (the whole frame through one more full-screen pass), 0 = one multiply quad with the same per-channel gain (depth darkening and colour loss, without the saturation).
    // (A layer reads its share as QUALITY[scene.quality.tier].glow and the like, when it builds or each frame.)
    basic: { caustics: 0, particles: 0.18, shoals: 0.25, shoalsAround: 1, simEvery: 4, midEvery: 8, glow: 0, far: 0.2, sheen: 0, resolution: 0.5, eyes: 600, lids: 0, liteTerrain: true, micro: 0.3, lead: 1, kelpBack: 0, plantSegments: 5, animEvery: 3, poseEvery: 3, grade: 0, pairs: 0 },
    low: { caustics: 0, particles: 0.35, shoals: 0.45, shoalsAround: 2, simEvery: 3, midEvery: 5, glow: 0, far: 0.4, sheen: 1, resolution: 0.67, eyes: 1000, lids: 1, liteTerrain: true, micro: 0.6, lead: 2, kelpBack: 0.5, plantSegments: 7, animEvery: 2, poseEvery: 2, grade: 1, pairs: 1 },
    medium: { caustics: 0.7, particles: 0.6, shoals: 0.7, shoalsAround: 2, simEvery: 2, midEvery: 4, glow: 1, far: 0.7, sheen: 1, resolution: 0.8, eyes: Infinity, lids: 1, liteTerrain: false, micro: 1, lead: 3, kelpBack: 1, plantSegments: 10, animEvery: 1, poseEvery: 1, grade: 1, pairs: 1 },
    high: { caustics: 1, particles: 1, shoals: 1, shoalsAround: 2, simEvery: 2, midEvery: 3, glow: 1, far: 1, sheen: 1, resolution: 1, eyes: Infinity, lids: 1, liteTerrain: false, micro: 1, lead: 3, kelpBack: 1, plantSegments: 10, animEvery: 1, poseEvery: 1, grade: 1, pairs: 1 },
    tune: {
        windowS: 2,       // the frame rate is the average over this many seconds
        lowFps: 26,       // under this for `lowS` seconds: a tier down (not 30: a phone held at 30 Hz by battery saving averages 29.9 and is not slow)
        lowS: 2,
        highFps: 50,      // over this in the start's probe: a tier up (the only way up)
        settleS: 2,       // after a change nothing is judged for this long (the change itself costs frames)
        startS: 2,        // ... and this long after the start (the start fade)
        probeS: 3,        // then the frame rate of this many seconds decides the tier at once: phones differ a lot, and a weak one must not wait for one step at a time
        probeFar: 20,     // under this in the probe: two tiers down at once (under lowFps: one down; over highFps: one up)
        probeFloor: 10,   // ... and under this: three
        slowCap: 1000     // ms: a frame counts as at most this long (a slow phone's frames all count; the one after a hidden page does not: pause())
    }
};

/** A scene's current share of one look (`glow`, `far`, ...): the high tier's while the scene has no tier yet (during create). */
export function shareOf(scene, key, cfg = QUALITY) {
    return cfg[scene.quality?.tier ?? 'high'][key];
}

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
 * It first probes: the frame rate right after the start puts it on the fitting tier at once, up
 * or down (so a saved low tier is tried upward again at every start). After that it only steps
 * down, a tier at a time with a pause between (playtest: a phone that cannot keep up must get
 * there, and nothing may flip back and forth). Every frame counts, however long (a phone may be
 * that slow), up to `slowCap` ms; only the frame after a pause (`pause()`: the page was hidden) does not.
 */
export function createAutotune(start, cfg = QUALITY) {
    const T = cfg.tune, frames = [];      // the window: [ms, ...]
    let at = cfg.tiers.indexOf(start), sum = 0, low = 0, settle = T.startS, paused = false;      // settle: the start's own slow frames are not judged either
    if (at < 0) at = cfg.tiers.length - 1;
    let probe = { s: 0, ms: 0, n: 0 };      // the start's probe, null once it has decided
    const changed = () => { low = 0; settle = T.settleS; frames.length = 0; sum = 0; return api.tier; };
    const api = {
        get tier() { return cfg.tiers[at]; },
        fps: 60,
        /** The page was hidden: the next frame's length is the time away, not the phone's speed. */
        pause() { paused = true; },
        step(dtMs) {
            if (!(dtMs > 0)) return null;
            if (paused) { paused = false; return null; }
            dtMs = Math.min(dtMs, T.slowCap);
            frames.push(dtMs); sum += dtMs;
            while (frames.length > 1 && sum - frames[0] > T.windowS * 1000) sum -= frames.shift();
            api.fps = frames.length * 1000 / sum;
            const dt = dtMs / 1000;
            if (settle > 0) { settle -= dt; low = 0; return null; }
            if (probe) {
                probe.s += dt; probe.ms += dtMs; probe.n++;
                if (probe.s < T.probeS) return null;
                const fps = probe.n * 1000 / probe.ms, was = at;
                probe = null;
                at = Math.max(0, Math.min(cfg.tiers.length - 1, at + (fps < T.probeFloor ? -3 : fps < T.probeFar ? -2 : fps < T.lowFps ? -1 : fps > T.highFps ? 1 : 0)));
                return at === was ? null : changed();
            }
            if (sum < T.windowS * 500) return null;      // not enough frames in the window yet
            low = api.fps < T.lowFps ? low + dt : 0;
            if (low < T.lowS || at === 0) return null;
            at--;
            return changed();
        }
    };
    return api;
}
