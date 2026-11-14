// Seabirds near islands (pure, no Phaser; spec gamedesign §5.0d). Gannets circle above the
// water near a coast and plunge-dive after fish: shoals first (the world hunts without the
// player), the player only when near the surface and out of cover. Every dive is telegraphed:
// the bird's shadow slides over the water to its target, then it hovers with folded wings
// (aimS) and dives in a straight line at where the target WAS, so a swerve escapes it. A hit is
// reported once ('hit', the scene takes half a heart); a puffed fish makes it bounce off
// ('bounce'). After a dive it floats on the surface, then takes off again.
// Units: px and s; y grows downward; `surfaceY(x)` = the water surface.

export const SEABIRD = {
    range: 1400,       // px: a bird patrols this far either side of its home coast
    height: 280,       // px above the surface it circles at
    speed: 170,        // px/s circling
    spotX: 520,        // px: notices prey within this horizontal distance
    reach: 180,        // px: prey must be at most this deep to be worth a dive
    aimS: 1.0,         // s of folded-wing hover before the dive (the readable moment)
    diveSpeed: 1150,   // px/s through the air
    depth: 300,        // px: the deepest a dive reaches under the surface
    waterDrag: 5,      // 1/s: how fast it slows in the water
    hitR: 70,          // px: touching distance during the dive
    restS: 2.5,        // s floating on the surface after a dive
    climbS: 1.4,       // s taking off back to circling height
    playerCooldownS: 6 // s between dives at a player (per bird)
};

/** A bird circling above `homeX`; `seed` varies its loop. */
export function createSeabird(homeX, surfaceY, opts = {}, seed = 0) {
    const c = { ...SEABIRD, ...opts };
    return { c, homeX, x: homeX, y: surfaceY(homeX) - c.height, vx: c.speed, vy: 0, state: 'circle', timer: 0, seed,
        target: null, aim: { x: 0, y: 0 }, cooldown: 0, struck: false };
}

/** Is this player a fair target: near the surface, not in cover, not big or puffed? */
function prey(p, b, env) {
    if (!p || p.big || p.puffed) return false;
    const under = p.y - env.surfaceY(p.x);
    if (under < 0 || under > b.c.reach) return false;
    if (Math.abs(p.x - b.x) > b.c.spotX || Math.abs(p.x - b.homeX) > b.c.range) return false;
    return !env.covered?.(p.x, p.y);
}

function pickTarget(b, env) {
    if (b.cooldown <= 0) {
        const players = env.players || (env.player ? [env.player] : []);
        let best = null, bd = Infinity;
        for (const p of players) {
            const d = Math.abs(p.x - b.x);
            if (d < bd && prey(p, b, env)) { best = p; bd = d; }
        }
        if (best) return { kind: 'player', ref: best };
    }
    for (const s of env.shoals || []) {
        const under = s.y - env.surfaceY(s.x);
        if (under >= 0 && under <= b.c.reach && Math.abs(s.x - b.x) < b.c.spotX && Math.abs(s.x - b.homeX) < b.c.range) return { kind: 'shoal', ref: s };
    }
    return null;
}

/**
 * Advance by dt. env: { surfaceY(x), player: the local fish | null, players: everyone (optional),
 * shoals: [{x, y}] (optional), covered(x, y) (optional) }. A player is { x, y, puffed?, big? }.
 * Returns 'aim' when a dive is announced, 'dive' when it starts, 'splash' when it enters the
 * water, 'hit' once when it touches the local player, 'bounce' off a puffed one, 'strike' at a
 * shoal, else null.
 */
export function stepSeabird(b, dt, env) {
    const c = b.c, sy = env.surfaceY(b.x);
    let event = null;
    b.timer += dt;
    b.cooldown = Math.max(0, b.cooldown - dt);

    if (b.state === 'circle') {
        // A lazy loop over the home coast: turn back at the edge of its range.
        if (b.x > b.homeX + c.range * 0.6) b.vx = -c.speed;
        else if (b.x < b.homeX - c.range * 0.6) b.vx = c.speed;
        b.x += b.vx * dt;
        b.y = sy - c.height + Math.sin(b.timer * 0.9 + b.seed) * 30;
        const t = pickTarget(b, env);
        if (t) { b.target = t; b.state = 'aim'; b.timer = 0; event = 'aim'; }
    } else if (b.state === 'aim') {
        // Glide over the target, then hang still: its shadow sits on the water above the prey.
        const p = b.target.ref;
        b.x += Math.max(-c.speed * 2 * dt, Math.min(c.speed * 2 * dt, p.x - b.x));
        b.y = sy - c.height;
        if (b.target.kind === 'player' && !prey(p, b, env)) { b.target = null; b.state = 'circle'; b.timer = 0; }
        else if (b.timer >= c.aimS) {
            b.aim.x = p.x; b.aim.y = Math.min(p.y, env.surfaceY(p.x) + c.depth);
            const dx = b.aim.x - b.x, dy = b.aim.y - b.y, d = Math.hypot(dx, dy) || 1;
            b.vx = dx / d * c.diveSpeed; b.vy = dy / d * c.diveSpeed;
            b.state = 'dive'; b.timer = 0; b.struck = false; event = 'dive';
            if (b.target.kind === 'player') b.cooldown = c.playerCooldownS;
        }
    } else if (b.state === 'dive') {
        const wasAbove = b.y < sy;
        if (b.y >= sy) { const k = Math.exp(-c.waterDrag * dt); b.vx *= k; b.vy *= k; }
        b.x += b.vx * dt; b.y += b.vy * dt;
        const nsy = env.surfaceY(b.x);
        if (wasAbove && b.y >= nsy) event = 'splash';
        if (!b.struck) {
            const players = env.players || (env.player ? [env.player] : []);
            for (const p of players) {
                if (Math.hypot(p.x - b.x, p.y - b.y) > c.hitR) continue;
                b.struck = true;
                if (p.puffed || p.big) { event = 'bounce'; b.vy = -Math.abs(b.vy) * 0.3; }
                else if (p === env.player) event = 'hit';
                break;
            }
            if (!b.struck && b.target?.kind === 'shoal' && !wasAbove && Math.hypot(b.target.ref.x - b.x, b.target.ref.y - b.y) < c.hitR * 2) {
                b.struck = true; event = 'strike';
            }
        }
        const deep = b.y - nsy >= c.depth, slow = b.y >= nsy && Math.hypot(b.vx, b.vy) < 120;
        if (event === 'bounce' || deep || slow) { b.state = 'rise'; b.timer = 0; }
    } else if (b.state === 'rise') {
        // Pops back up to the surface and floats.
        b.vx *= Math.exp(-3 * dt);
        b.x += b.vx * dt;
        b.y += (sy - b.y) * Math.min(1, dt * 4);
        if (Math.abs(b.y - sy) < 4) { b.y = sy; b.state = 'rest'; b.timer = 0; }
    } else if (b.state === 'rest') {
        b.y = sy;
        if (b.timer >= c.restS) { b.state = 'climb'; b.timer = 0; b.vx = (b.homeX >= b.x ? 1 : -1) * c.speed; }
    } else if (b.state === 'climb') {
        b.x += b.vx * dt;
        b.y = sy - c.height * Math.min(1, b.timer / c.climbS);
        if (b.timer >= c.climbS) { b.state = 'circle'; b.timer = 0; b.target = null; }
    }
    return event;
}

/** Where its shadow falls on the water (x), or null when it is not above the water hunting. */
export const shadowX = b => (b.state === 'circle' || b.state === 'aim' ? b.x : null);
