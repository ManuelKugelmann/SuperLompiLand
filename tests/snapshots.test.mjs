import test from 'node:test';
import assert from 'node:assert/strict';
import { SnapshotBuffer, SNAP } from '../net/snapshots.js';

// Truth: a swimming path. Position in px, velocity in px per 60 Hz step.
const X = t => 2200 * Math.sin(t / 1900), Y = t => 700 * Math.sin(t / 1300) + 900;
const VX = t => (2200 / 1900) * Math.cos(t / 1900) * (1000 / 60), VY = t => (700 / 1300) * Math.cos(t / 1300) * (1000 / 60);
const SKEW = 987654; // the sender's clock is unrelated to ours
const STEP_MS = 1000 / 60;

const rng = seed => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

const snapAt = (k, t) => ({ n: k, t: t + SKEW, x: Math.round(X(t)), y: Math.round(Y(t)), vx: +VX(t).toFixed(2), vy: +VY(t).toFixed(2), s: 'normal', f: 1, c: 'lompi' });

// Network conditions: delay in ms per packet, or lost.
const PROFILES = {
    good: r => ({ d: 40 + r() * 8 }),
    jittery: r => ({ d: 50 + r() * 120 }),
    bursty: (r, t) => { const ph = t % 2500; return { d: ph < 450 ? 450 - ph + 40 : 40 + r() * 10 }; },
    lossy: r => ({ lost: r() < 0.12, d: 60 + r() * 30 + (r() < 0.12 ? 150 : 0) }),
    hostile: (r, t) => { const ph = t % 3000; return { lost: r() < 0.1, d: 60 + r() * 100 + (ph < 500 ? 500 - ph : 0) + (r() < 0.1 ? 180 : 0) }; }
};

/** Play 20 s of a 20 Hz stream through a network profile, drawing at 60 fps; measure smoothness. */
function simulate(profile) {
    const r = rng(42);
    const packets = [];
    for (let k = 0, t = 0; t < 20000; k++, t += 50) {
        const p = profile(r, t);
        if (!p.lost) packets.push({ arrive: t + p.d, snap: snapAt(k, t) });
    }
    packets.sort((a, b) => a.arrive - b.arrive);
    const buf = new SnapshotBuffer();
    const xs = [], ys = [];
    let pi = 0;
    for (let T = 3000; T < 20000; T += 1000 / 60) {
        while (pi < packets.length && packets[pi].arrive <= T) { const pk = packets[pi++]; buf.push(pk.snap, pk.arrive); }
        const p = buf.sample(T);
        xs.push(p.x); ys.push(p.y);
    }
    const dev = [];
    let jumps = 0;
    for (let i = 1; i < xs.length; i++) {
        const step = Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
        const T = 3000 + i * (1000 / 60), ref = Math.hypot(VX(T), VY(T));
        dev.push(Math.abs(step - ref));
        if (step > 2.2 * ref + 4) jumps++;
    }
    dev.sort((a, b) => a - b);
    return { p99: dev[Math.floor(dev.length * 0.99)], jumps };
}

test('clean network: motion is smooth even though sender and receiver clocks are unrelated', () => {
    const s = simulate(PROFILES.good);
    assert.ok(s.p99 < 4, `p99 step error ${s.p99}`);
    assert.equal(s.jumps, 0);
});

test('jitter, loss and reordering do not make the fish jump', () => {
    for (const name of ['jittery', 'lossy']) {
        const s = simulate(PROFILES[name]);
        assert.equal(s.jumps, 0, `${name}: jumps`);
        assert.ok(s.p99 < 25, `${name}: p99 step error ${s.p99}`);
    }
});

test('stalls that release packets in a burst stay mostly smooth', () => {
    for (const name of ['bursty', 'hostile']) {
        const s = simulate(PROFILES[name]);
        assert.ok(s.jumps <= 8, `${name}: ${s.jumps} jump frames`);
        assert.ok(s.p99 < 40, `${name}: p99 step error ${s.p99}`);
    }
});

test('late and duplicate packets are ignored', () => {
    const b = new SnapshotBuffer();
    assert.equal(b.push(snapAt(5, 250), 1000), true);
    assert.equal(b.push(snapAt(5, 250), 1010), false, 'duplicate');
    assert.equal(b.push(snapAt(4, 200), 1020), false, 'older than the newest');
    assert.equal(b.push(snapAt(6, 300), 1030), true);
    assert.equal(b.buf.length, 2);
});

test('garbage snapshots are rejected', () => {
    const b = new SnapshotBuffer();
    for (const bad of [null, {}, { n: 1, t: 'x', x: 1, y: 1 }, { n: 1, t: 1, x: 'a', y: 1 }]) assert.equal(b.push(bad, 0), false);
    assert.equal(b.sample(0), null);
});

test('a teleport (respawn) snaps instead of sliding across the sea', () => {
    const b = new SnapshotBuffer();
    for (let k = 0; k < 6; k++) b.push({ ...snapAt(k, k * 50), x: 100 + k, y: 100 }, 1000 + k * 50);
    b.push({ ...snapAt(6, 300), x: 100 + SNAP.teleportDist + 500, y: 100 }, 1300);
    assert.equal(b.buf.length, 1);
    const p = b.sample(1300 + 500);
    assert.ok(Math.abs(p.x - (100 + SNAP.teleportDist + 500)) < 400, 'drawn near the new spot, not on the way there');
});

test('a quiet player goes stale; the render cushion stays within bounds', () => {
    const b = new SnapshotBuffer();
    for (let k = 0; k < 10; k++) b.push(snapAt(k, k * 50), 1000 + k * 50 + (k % 3) * 70);
    assert.ok(b.delay >= SNAP.minDelay && b.delay <= SNAP.maxDelay);
    assert.equal(b.sample(1500).stale, false);
    assert.equal(b.sample(1500 + SNAP.staleMs + 10).stale, true);
});

test('a slow sender (low frame rate, one snapshot per 100 ms) is interpolated, not overshot', () => {
    // Simulated slow phone: sends every 100 ms; its fish really moves 0.5x the reported velocity
    // (the game loop drops steps), the case where coasting on velocity would overshoot.
    const b = new SnapshotBuffer();
    const pos = t => ({ x: 800 * Math.sin(t / 2500), y: 900 });
    let worst = 0;
    for (let T = 0; T < 12000; T += 1000 / 60) {
        const k = Math.floor(T / 100);
        if (T % 100 < 1000 / 60) {
            const t = k * 100, p = pos(t), q = pos(t + 16.7);
            b.push({ n: k, t: t + SKEW, x: Math.round(p.x), y: p.y, vx: (q.x - p.x) * 2, vy: 0, s: 'normal', f: 1, c: 'lompi' }, T + 40);
        }
        const s = b.sample(T);
        if (T > 3000 && s) {
            let best = 1e9;
            for (let lag = 0; lag <= 600; lag += 5) best = Math.min(best, Math.abs(pos(T - lag).x - s.x));
            worst = Math.max(worst, best);
        }
    }
    assert.ok(b.delay >= 200, `cushion covers the slow send rate (${Math.round(b.delay)} ms)`);
    assert.ok(worst < 6, `drawn position always sits on the true path (worst ${worst.toFixed(1)} px off)`);
});

test('prediction: water slows a starved fish down, air makes it fall on an arc', async () => {
    const { predict, PREDICT } = await import('../net/snapshots.js');
    const water = predict({ x: 0, y: 500, vx: 10, vy: 0 }, 500);
    assert.ok(water.vx < 10 && water.vx > 0, 'slowed, still moving');
    assert.ok(water.x > 0 && water.x < 10 * 30, 'travelled less than at full speed');
    const air = predict({ x: 0, y: PREDICT.surfaceY - 50, vx: 6, vy: -8 }, 500);
    assert.ok(air.vy > -8, 'gravity pulls the jump down');
    assert.ok(air.vx < 6 && air.vx > 5.5, 'almost no drag in the air');
});

test('a late packet after a prediction is blended in, never snapped', () => {
    const b = new SnapshotBuffer();
    // Steady swim east, 20 Hz.
    let now = 1000;
    for (let k = 0; k < 10; k++, now += 50) b.push({ n: k, t: k * 50 + SKEW, x: k * 30, y: 500, vx: 10, vy: 0, s: 'normal', f: 1, c: 'lompi' }, now);
    // Starve for 400 ms: the fish is predicted east.
    let prev = b.sample(now);
    for (let T = now; T < now + 400; T += STEP_MS) prev = b.sample(T);
    // The real fish had turned north: packets arrive late in a burst.
    for (let k = 10; k < 18; k++) b.push({ n: k, t: k * 50 + SKEW, x: 270, y: 500 - (k - 9) * 25, vx: 0, vy: -8, s: 'normal', f: 1, c: 'lompi' }, now + 400);
    let worst = 0;
    for (let T = now + 400; T < now + 900; T += STEP_MS) {
        const p = b.sample(T);
        worst = Math.max(worst, Math.hypot(p.x - prev.x, p.y - prev.y));
        prev = p;
    }
    assert.ok(worst < 40, `largest frame step after the correction: ${worst.toFixed(1)} px`);
});
