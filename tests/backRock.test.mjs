import test from 'node:test';
import assert from 'node:assert/strict';
import { BACK_ROCK, backRockCover, backRockReach } from '../game/level/backRock.js';
import { BIOMES } from '../game/level/biomes.js';
import { FIELD, createField } from '../game/level/density.js';

const field = createField(1337), T = FIELD.threshold, SPAN = 960;
const blue = BIOMES.find(b => b.id === 'blue');

test('every biome has a back-rock reach; the open ocean has none', () => {
    for (const b of BIOMES) assert.ok(Number.isFinite(b.backRock) && b.backRock >= 0, b.id);
    assert.equal(blue.backRock, 0);
    assert.equal(backRockReach(blue.from + blue.width / 2), 0);
});

test('no back rock in the middle of the open ocean', () => {
    const x = Math.round((blue.from + blue.width / 2) / SPAN) * SPAN;
    const { cov, any } = backRockCover(field, T, x, 1920, SPAN);
    assert.equal(any, false);
    assert.ok(cov.every(v => v === 0));
});

test('back rock covers water under rock and fades without hard edges', () => {
    let found = false;
    for (let cx = 0; cx < 30 && !found; cx++) {
        for (let cy = 1; cy < 4 && !found; cy++) {
            const ox = cx * SPAN, oy = cy * SPAN;
            const { cov, N, C, m, any } = backRockCover(field, T, ox, oy, SPAN);
            if (!any) continue;
            for (let j = m; j < N - m - 1; j++) {
                for (let i = m; i < N - m - 1; i++) {
                    const x = ox + (i - m + 0.5) * C, y = oy + (j - m + 0.5) * C;
                    if (field.density(x, y) < T - 0.1 && cov[j * N + i] > 0.3) found = true;
                    assert.ok(Math.abs(cov[j * N + i + 1] - cov[j * N + i]) < 0.35, `sideways step at ${i},${j}`);
                }
            }
        }
    }
    assert.ok(found, 'some open water under rock has back rock');
});

test('coverage is seamless across chunk borders', () => {
    const ox = 2 * SPAN, oy = 2 * SPAN, a = backRockCover(field, T, ox, oy, SPAN), b = backRockCover(field, T, ox + SPAN, oy, SPAN);
    const n = Math.round(SPAN / BACK_ROCK.cell), m = a.m;
    for (let j = m; j < a.N - m; j++) {
        // the same world cell seen from both chunks
        assert.ok(Math.abs(a.cov[j * a.N + m + n] - b.cov[j * b.N + m]) < 0.02, `row ${j}`);
    }
});

test('distance to rock is 0 in rock and grows away from it', () => {
    const { dist, N, C, m } = backRockCover(field, T, 0, 960, SPAN);
    let inRock = 0, far = 0;
    for (let j = m; j < N - m; j++) {
        for (let i = m; i < N - m; i++) {
            const d = field.density((i - m + 0.5) * C, 960 + (j - m + 0.5) * C);
            if (d > T) { assert.equal(dist[j * N + i], 0); inRock++; }
            else { assert.ok(dist[j * N + i] >= C * 0.99, `water cell ${i},${j}`); far++; }
        }
    }
    assert.ok(inRock > 0 && far > 0);
});

test('an island gets a pillar behind it down to the seabed; a wide cave roof does not', () => {
    const reef = BIOMES.find(b => b.id === 'reef'), x0 = Math.round((reef.from + 2000) / SPAN) * SPAN;
    const seabed = 1960 + 900;
    // An island 400 px wide and 200 thick, 600 px of water under it, then the seabed.
    const island = { density: (x, y) => (y > seabed || (Math.abs(x - (x0 + 480)) < 200 && y > 1960 + 100 && y < 1960 + 300)) ? 1 : 0 };
    const a = backRockCover(island, 0.5, x0, 1960, SPAN);
    const cellAt = (r, x, y) => r.cov[Math.floor((y - 1960) / r.C + r.m) * r.N + Math.floor((x - x0) / r.C + r.m)];
    // the raw (pre-blur) pillar is blurred; under the island's middle it stays strong
    assert.ok(cellAt(a, x0 + 480, 1960 + 600) > 0.6, `under the island: ${cellAt(a, x0 + 480, 1960 + 600)}`);
    // A roof across the whole grid (a cave), the same gap below: no pillar, only the fading skirt.
    const roof = { density: (x, y) => (y > seabed || (y > 1960 + 100 && y < 1960 + 300)) ? 1 : 0 };
    const b = backRockCover(roof, 0.5, x0, 1960, SPAN);
    assert.ok(cellAt(b, x0 + 480, 1960 + 760) < cellAt(a, x0 + 480, 1960 + 760), 'a cave roof makes no pillar');
});

test('a pillar under an island continues across the chunk border below it', () => {
    const reef = BIOMES.find(b => b.id === 'reef'), x0 = Math.round((reef.from + 2000) / SPAN) * SPAN, oy = 1920;
    const seabed = oy + SPAN + 700;
    // An island just above the border between two stacked chunks, the seabed in the lower one.
    const f = { density: (x, y) => (y > seabed || (Math.abs(x - (x0 + 480)) < 200 && y > oy + SPAN - 260 && y < oy + SPAN - 60)) ? 1 : 0 };
    const up = backRockCover(f, 0.5, x0, oy, SPAN), lo = backRockCover(f, 0.5, x0, oy + SPAN, SPAN);
    const cell = (r, top, y) => r.cov[Math.floor((y - top) / r.C + r.m) * r.N + Math.floor(480 / r.C + r.m)];
    // just below the island, in the lower chunk, the pillar is there as in the upper chunk's margin
    const y = oy + SPAN + 120;
    assert.ok(Math.abs(cell(up, oy, y) - cell(lo, oy + SPAN, y)) < 0.05, `${cell(up, oy, y)} vs ${cell(lo, oy + SPAN, y)}`);
    assert.ok(cell(lo, oy + SPAN, y) > 0.6);
});
