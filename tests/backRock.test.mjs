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
