// Swarms of small fish (pure, no Phaser; spec gamedesign §6.2 "Swarms" and "momentum").
// Boids on a spatial grid in typed arrays: separation, alignment and cohesion, a
// leader that wanders a home range, avoidance of rock ahead, drift with the water,
// and the player: the swarm parts around Lompi's predicted path, a fast dash sends a
// panic wave through it, and a slow, calm Lompi is let inside. Every fish has
// momentum (limited acceleration and turn), so the swarm flows instead of snapping.
// Units: px and px/s.

export const SWARM = {
    neighbourR: 70,       // px: who counts as a neighbour
    separationR: 26,      // px: too close
    weights: { separation: 2.2, alignment: 1.0, cohesion: 0.7, leader: 0.5, avoid: 3.0, player: 4.0, home: 0.6 },
    speed: 90,            // cruise px/s
    maxSpeed: 260,        // panicking
    maxAccel: 420,        // px/s² (momentum: no instant turns)
    homeR: 420,           // the leader wanders within this of the anchor
    lookAhead: 60,        // px: probe ahead for rock
    playerR: 150,         // px: personal space around a calm player
    playerPredictS: 0.35, // s: avoid where the player will be
    calmSpeed: 120,       // px/s: slower than this, the swarm lets the player in
    dashSpeed: 520,       // px/s: faster than this nearby triggers panic
    panicR: 260,          // px
    panicDecay: 0.6,      // per s
    panicSpread: 0.85     // share passed on to neighbours (a wave, not a switch)
};

export function createSwarm({ count = 120, x = 0, y = 0, random = Math.random, ...opts } = {}) {
    const P = { ...SWARM, ...opts, weights: { ...SWARM.weights, ...(opts.weights || {}) } };
    const n = count;
    const px = new Float32Array(n), py = new Float32Array(n), vx = new Float32Array(n), vy = new Float32Array(n);
    const panic = new Float32Array(n), turn = new Float32Array(n), quirk = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const a = random() * Math.PI * 2, r = Math.sqrt(random()) * 120;
        px[i] = x + Math.cos(a) * r; py[i] = y + Math.sin(a) * r * 0.6;
        const h = random() * Math.PI * 2;
        vx[i] = Math.cos(h) * P.speed; vy[i] = Math.sin(h) * P.speed * 0.4;
        quirk[i] = 0.85 + random() * 0.3;              // individual speed and reaction
    }
    const anchor = { x, y };
    const leader = { x, y, tx: x, ty: y, retarget: 0 };
    const cell = P.neighbourR;
    let grid = new Map();
    const key = (cx, cy) => (cx * 73856093) ^ (cy * 19349663);

    function buildGrid() {
        grid = new Map();
        for (let i = 0; i < n; i++) {
            const k = key(Math.floor(px[i] / cell), Math.floor(py[i] / cell));
            let list = grid.get(k);
            if (!list) grid.set(k, (list = []));
            list.push(i);
        }
    }

    const flow = { x: 0, y: 0 };
    return {
        count: n, x: px, y: py, vx, vy, panic, turn, anchor, leader,

        /** Centre of the swarm (for cameras, spawning checks, predators). */
        centre() {
            let sx = 0, sy = 0;
            for (let i = 0; i < n; i++) { sx += px[i]; sy += py[i]; }
            return { x: sx / n, y: sy / n };
        },

        /** A sudden event at (x, y) (a special, a splash): fish within r panic; the wave does the rest. */
        startle(x, y, r = P.panicR) {
            for (let i = 0; i < n; i++) if (Math.hypot(px[i] - x, py[i] - y) < r) panic[i] = 1;
        },

        /**
         * Advance by dt seconds. env: isOpen(x, y), flowAt(x, y, out) in px/s,
         * player {x, y, vx, vy} in px/s (all optional).
         */
        step(dt, env = {}) {
            const W = P.weights;
            // Players: the local fish and, in a room, its friends (`players`), or one `player`.
            const players = env.players || (env.player ? [env.player] : []);
            // Leader: wander the home range, keep to open water.
            leader.retarget -= dt;
            const ld = Math.hypot(leader.tx - leader.x, leader.ty - leader.y);
            if (leader.retarget <= 0 || ld < 40) {
                for (let k = 0; k < 8; k++) {
                    const a = random() * Math.PI * 2, r = random() * P.homeR;
                    const tx = anchor.x + Math.cos(a) * r, ty = anchor.y + Math.sin(a) * r * 0.5;
                    if (!env.isOpen || env.isOpen(tx, ty)) { leader.tx = tx; leader.ty = ty; break; }
                }
                leader.retarget = 4 + random() * 5;
            }
            const lv = Math.min(P.speed * 0.8, ld) || 0;
            if (ld > 1) { leader.x += (leader.tx - leader.x) / ld * lv * dt; leader.y += (leader.ty - leader.y) / ld * lv * dt; }

            // Each player: where it will be, how fast, how calm.
            // fright > 1: a predator (Sharky). Fish keep more room and never let it in.
            const ps = players.map(pl => {
                const speed = Math.hypot(pl.vx, pl.vy), fright = pl.fright || 1;
                const calm = speed < P.calmSpeed && fright <= 1;
                return { pl, speed, calm, ppx: pl.x + pl.vx * P.playerPredictS, ppy: pl.y + pl.vy * P.playerPredictS,
                    personal: (calm ? P.playerR * 0.45 : P.playerR * (1 + Math.min(1.5, speed / P.dashSpeed))) * fright };
            });

            buildGrid();
            const decay = Math.exp(-P.panicDecay * dt);
            for (let i = 0; i < n; i++) {
                let sx = 0, sy = 0, ax = 0, ay = 0, cx = 0, cy = 0, m = 0, pn = 0;
                const gx = Math.floor(px[i] / cell), gy = Math.floor(py[i] / cell);
                for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
                    const list = grid.get(key(gx + ox, gy + oy));
                    if (!list) continue;
                    for (const j of list) {
                        if (j === i) continue;
                        const dx = px[j] - px[i], dy = py[j] - py[i], d2 = dx * dx + dy * dy;
                        if (d2 > P.neighbourR * P.neighbourR) continue;
                        m++;
                        ax += vx[j]; ay += vy[j]; cx += dx; cy += dy;
                        if (panic[j] > pn) pn = panic[j];
                        if (d2 < P.separationR * P.separationR && d2 > 1e-6) { const d = Math.sqrt(d2); sx -= dx / d * (P.separationR - d); sy -= dy / d * (P.separationR - d); }
                    }
                }
                // Panic spreads from neighbour to neighbour (a wave).
                panic[i] = Math.max(panic[i] * decay, pn * P.panicSpread * decay);
                let fx = sx * W.separation, fy = sy * W.separation;
                if (m) {
                    fx += (ax / m - vx[i]) * W.alignment * 1.5 + cx / m * W.cohesion * 0.8;
                    fy += (ay / m - vy[i]) * W.alignment * 1.5 + cy / m * W.cohesion * 0.8;
                }
                // Follow the leader loosely, and stay near home.
                fx += (leader.x - px[i]) * W.leader * 0.3; fy += (leader.y - py[i]) * W.leader * 0.3;
                // The players: part around each predicted path; a dash nearby starts a panic.
                let near = null, nearD = Infinity;
                for (const { pl, speed: pspeed, calm, ppx, ppy, personal } of ps) {
                    const pd = Math.hypot(px[i] - pl.x, py[i] - pl.y);
                    if (pd < nearD) { nearD = pd; near = pl; }
                    const dx = px[i] - ppx, dy = py[i] - ppy, d = Math.hypot(dx, dy);
                    if (d < personal && d > 1e-3) {
                        const k = (personal - d) / personal;
                        // Part like a curtain: move off the player's path to the near side.
                        let ex = dx / d, ey = dy / d;
                        if (pspeed > 20) {
                            const qx = -pl.vy / pspeed, qy = pl.vx / pspeed, side = dx * qx + dy * qy >= 0 ? 1 : -1;
                            ex = qx * side + ex * 0.35; ey = qy * side + ey * 0.35;
                        }
                        fx += ex * k * W.player * 400; fy += ey * k * W.player * 400;
                        if (!calm) panic[i] = Math.max(panic[i], k * 0.7);   // startled: a burst of speed
                    }
                    if (pspeed > P.dashSpeed && pd < P.panicR) panic[i] = 1;
                }
                // Rock ahead: turn away from it before touching it.
                const sp = Math.hypot(vx[i], vy[i]) || 1;
                if (env.isOpen && !env.isOpen(px[i] + vx[i] / sp * P.lookAhead, py[i] + vy[i] / sp * P.lookAhead)) {
                    fx += -vx[i] / sp * W.avoid * 40 + -vy[i] / sp * W.avoid * 25;
                    fy += -vy[i] / sp * W.avoid * 40 + vx[i] / sp * W.avoid * 25;
                }
                if (panic[i] > 0.05 && near) {            // flee from the nearest player while panicking
                    const dx = px[i] - near.x, dy = py[i] - near.y, d = Math.hypot(dx, dy) || 1;
                    fx += dx / d * panic[i] * 120; fy += dy / d * panic[i] * 120;
                }
                // Momentum: limited acceleration, then speed limits.
                const fl = Math.hypot(fx, fy), amax = P.maxAccel * quirk[i] * (1 + panic[i] * 3);
                if (fl > amax) { fx = fx / fl * amax; fy = fy / fl * amax; }
                const ovx = vx[i], ovy = vy[i];
                vx[i] += fx * dt; vy[i] += fy * dt;
                const top = (P.speed + (P.maxSpeed - P.speed) * panic[i]) * quirk[i];
                const s = Math.hypot(vx[i], vy[i]);
                if (s > top) { vx[i] *= top / s; vy[i] *= top / s; }
                if (s < P.speed * 0.4) { const k = (P.speed * 0.4) / (s || 1); vx[i] *= k; vy[i] *= k; }   // fish never stop
                // Turning amount (for the silver flank flash when the swarm wheels).
                const t = Math.abs(Math.atan2(ovx * vy[i] - ovy * vx[i], ovx * vx[i] + ovy * vy[i]));
                turn[i] = turn[i] * 0.85 + t * 0.15 / Math.max(dt, 1e-3) * 0.05;
                flow.x = 0; flow.y = 0;
                if (env.flowAt) env.flowAt(px[i], py[i], flow);
                const nx = px[i] + (vx[i] + flow.x) * dt, ny = py[i] + (vy[i] + flow.y) * dt;
                if (!env.isOpen || env.isOpen(nx, ny)) { px[i] = nx; py[i] = ny; }
                else { vx[i] = -vx[i] * 0.5; vy[i] = -vy[i] * 0.5; }   // bounce off, never into rock
            }
        }
    };
}
