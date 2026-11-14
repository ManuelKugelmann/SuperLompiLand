// A cleaner station on the reef (pure, no Phaser; spec gamedesign §5.0f). A grouper hovers with
// its mouth open while cleaner wrasse pick it over. A fish that floats in slowly and stays gets
// cleaned too: the wrasse come over to it, and after a moment it gets half a heart back (once
// per visit). Dashing in scatters the wrasse; they return after a while. Units: px and px/s, s.

export const CLEANER = {
    radius: 230,         // px around the station that count as "at the station"
    calmSpeed: 160,      // px/s: slower than this is "floating in calmly"
    cleanS: 2.0,         // s the wrasse need to clean a calm visitor
    scatterS: 2.5,       // s the wrasse stay away after a dash
    leaveR: 420,         // px: further than this ends the visit (and a new visit may heal again)
    heal: 0.5            // hearts given back once per visit
};

/** A station at (x, y). */
export function createStation(x, y, cfg = CLEANER) {
    return { cfg, x, y, state: 'grouper', timer: 0, healed: false, visiting: false };
}

/**
 * Advance by dt. `fish` = { x, y, speed } (px/s) or null. Returns 'clean' when the wrasse go to
 * the fish, 'heal' once when it has been cleaned, 'scatter' when a dash scares them, else null.
 * station.state: 'grouper' (wrasse on the grouper), 'fish' (on the visitor), 'scattered'.
 */
export function stepStation(st, dt, fish) {
    const c = st.cfg;
    st.timer += dt;
    const d = fish ? Math.hypot(fish.x - st.x, fish.y - st.y) : Infinity;
    if (d > c.leaveR) { st.visiting = false; st.healed = false; }
    else if (d < c.radius) st.visiting = true;
    let event = null;
    if (st.state === 'scattered') {
        if (st.timer >= c.scatterS) { st.state = 'grouper'; st.timer = 0; }
        return null;
    }
    const inside = d < c.radius;
    if (inside && fish.speed > c.calmSpeed * 2) {          // a dash: everyone flees
        st.state = 'scattered'; st.timer = 0;
        return 'scatter';
    }
    if (st.state === 'grouper') {
        if (inside && fish.speed < c.calmSpeed && !st.healed) { st.state = 'fish'; st.timer = 0; event = 'clean'; }
    } else if (st.state === 'fish') {
        if (!inside || fish.speed > c.calmSpeed) { st.state = 'grouper'; st.timer = 0; }
        else if (st.timer >= c.cleanS) { st.healed = true; st.state = 'grouper'; st.timer = 0; event = 'heal'; }
    }
    return event;
}
