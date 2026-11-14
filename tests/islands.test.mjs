import test from 'node:test';
import assert from 'node:assert/strict';
import { createField, FIELD, setPieceStretches } from '../game/level/density.js';
import { floorY, BIOMES } from '../game/level/biomes.js';
import { ghostShip, SET_PIECES } from '../game/level/setPieces.js';

const N = FIELD.node, T = FIELD.threshold;

/** Rock components on the node grid of a window that touch neither the seabed nor the window's sides: [{ x, y, nodes }]. */
function floating(f, x0, cols, rows) {
    const solid = new Uint8Array(cols * rows), seen = new Uint8Array(cols * rows), out = [];
    for (let j = 1; j < rows; j++) for (let i = 0; i < cols; i++) solid[j * cols + i] = f.density(x0 + i * N, j * N) > T ? 1 : 0;
    for (let s = 0; s < solid.length; s++) {
        if (!solid[s] || seen[s]) continue;
        const q = [s]; seen[s] = 1;
        let held = false, sx = 0, sy = 0;
        for (let k = 0; k < q.length; k++) {
            const i = q[k] % cols, j = (q[k] - i) / cols;
            sx += i; sy += j;
            if (i === 0 || i === cols - 1 || j === rows - 1 || j * N > floorY(x0 + i * N)) held = true;
            for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
                const ni = i + di, nj = j + dj, t = nj * cols + ni;
                if (ni >= 0 && nj >= 0 && ni < cols && nj < rows && solid[t] && !seen[t]) { seen[t] = 1; q.push(t); }
            }
        }
        if (!held) out.push({ x: x0 + sx / q.length * N, y: sy / q.length * N, nodes: q.length });
    }
    return out;
}

test('no stone floats: every rock hangs together with the seabed (playtest), except over the passages that are built on purpose', () => {
    const f = createField(1337), built = setPieceStretches(), ship = ghostShip().x;
    const meant = x => built.some(([x0, x1]) => x >= x0 - 1500 && x <= x1 + 1500) || Math.abs(x - ship) < SET_PIECES.ship.pinnacleHalf + 4000;
    // Stretches where floating rock was found before the rule: the mangrove, the reef's start, the harbour, the rocky shore.
    for (const x0 of [136000, 196000, 229000, 600000, 760000]) {
        const found = floating(f, x0, 80, 60).filter(b => !meant(b.x));
        assert.deepEqual(found.map(b => `${Math.round(b.x)},${Math.round(b.y)} (${b.nodes})`), [], `floating rock from ${x0} on`);
    }
});

test('rock that holds is left alone: the seabed, the coasts and the built passages are as they were', () => {
    const own = createField(1337), plain = createField(1337, 'none');
    let rock = 0, lost = 0;
    for (const b of BIOMES) for (let x = b.from + 500; x < b.from + b.width; x += 4000) for (let y = floorY(x) - 100; y < floorY(x) + 500; y += 100) {
        if (plain.density(x, y) > T) { rock++; if (own.density(x, y) <= T) lost++; }
    }
    assert.ok(rock > 500, `sampled ${rock} rock points near the seabed`);
    assert.equal(lost, 0, 'no seabed rock became water');
});

test('the grid the rule works on is the collision grid', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../game/level/LevelGenerator.js', import.meta.url), 'utf8');
    assert.match(src, new RegExp(`cell: ${N},`), 'LEVEL.cell and FIELD.node are the same');
});
