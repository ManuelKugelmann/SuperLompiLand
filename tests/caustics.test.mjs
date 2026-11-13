import test from 'node:test';
import assert from 'node:assert/strict';
import { causticPattern, sunlightAt, gradeMatrix } from '../game/fx/causticsMath.js';

test('caustic tile is seamless and has bright lines on a dark ground', () => {
    const n = 96, p = causticPattern(n, 16, 3);
    // Opposite edges continue each other: the last column/row is close to the first.
    let edge = 0, inner = 0;
    for (let i = 0; i < n; i++) {
        edge += Math.abs(p[i * n + n - 1] - p[i * n]) + Math.abs(p[(n - 1) * n + i] - p[i]);
        inner += Math.abs(p[i * n + n / 2] - p[i * n + n / 2 - 1]) + Math.abs(p[(n / 2) * n + i] - p[(n / 2 - 1) * n + i]);
    }
    assert.ok(edge <= inner * 1.6, `wrap seam (${edge.toFixed(1)}) no rougher than the inside (${inner.toFixed(1)})`);
    const mean = p.reduce((a, b) => a + b, 0) / p.length;
    assert.ok(mean > 0.05 && mean < 0.4, `mostly dark with lines (mean ${mean.toFixed(2)})`);
    assert.ok(Math.max(...p) > 0.95 && Math.min(...p) < 0.02);
});

test('same seed, same pattern', () => {
    assert.deepEqual(causticPattern(32, 8, 5), causticPattern(32, 8, 5));
});

test('sunlight is full under the surface, gone deep down, none above water', () => {
    assert.equal(sunlightAt(-10), 0);
    assert.ok(sunlightAt(0) > 0.99);
    assert.ok(sunlightAt(1300) > 0.3 && sunlightAt(1300) < 0.7);
    assert.equal(sunlightAt(5000), 0);
    for (let y = 0; y < 3000; y += 100) assert.ok(sunlightAt(y) >= sunlightAt(y + 100), 'never brighter deeper');
});

test('grade: grey stays grey near the surface; deep down red fades first', () => {
    const apply = (m, [r, g, b]) => [0, 1, 2].map(i => m[i * 5] * r + m[i * 5 + 1] * g + m[i * 5 + 2] * b + m[i * 5 + 4]);
    const top = apply(gradeMatrix(1), [0.5, 0.5, 0.5]);
    for (const c of top) assert.ok(Math.abs(c - 0.5) < 0.01, 'neutral grey unchanged by the saturation lift');
    const sat = apply(gradeMatrix(1), [0.8, 0.3, 0.2]);
    assert.ok(sat[0] > 0.8 && sat[2] < 0.2, 'colours a little richer in the light');
    const deep = apply(gradeMatrix(0), [0.8, 0.8, 0.8]);
    assert.ok(deep[0] < deep[1] && deep[1] < deep[2], `deep: red < green < blue (${deep.map(v => v.toFixed(2))})`);
});
