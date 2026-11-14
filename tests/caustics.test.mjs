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

test('exposure brightens sunlit water and does nothing in the dark', () => {
    const apply = (m, [r, g, b]) => [0, 1, 2].map(i => m[i * 5] * r + m[i * 5 + 1] * g + m[i * 5 + 2] * b + m[i * 5 + 4]);
    const lit = apply(gradeMatrix(1, 0, 0, 0.3), [0.5, 0.5, 0.5]);
    for (const c of lit) assert.ok(Math.abs(c - 0.65) < 0.01, `grey lifted by 30 % (${c})`);
    const darkNo = apply(gradeMatrix(0, 0, 0, 0.3), [0.5, 0.5, 0.5]);
    const darkRef = apply(gradeMatrix(0, 0, 0, 0), [0.5, 0.5, 0.5]);
    assert.deepEqual(darkNo, darkRef);
});

test('caustics on surfaces: none above the water, full near the surface, gone in the deep', async () => {
    const { SURFACE_CAUSTICS: C, causticDepth } = await import('../game/fx/causticsMath.js');
    assert.equal(causticDepth(-50), 0);
    assert.equal(causticDepth(0), 1);
    assert.equal(causticDepth(C.full), 1);
    assert.equal(causticDepth(C.gone), 0);
    assert.equal(causticDepth(C.gone + 2000), 0);
    let prev = 1;
    for (let y = C.full; y <= C.gone; y += 100) { const v = causticDepth(y); assert.ok(v <= prev, 'it only fades with depth'); prev = v; }
});

test('caustics are stronger in the light shafts, and the shafts repeat with the pattern\'s period', async () => {
    const { SURFACE_CAUSTICS: C, causticShaft } = await import('../game/fx/causticsMath.js');
    let lo = 1, hi = 0;
    for (let x = 0; x < C.period; x += 16) { const v = causticShaft(x, 300, 5); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    assert.ok(Math.abs(hi - 1) < 1e-6 && Math.abs(lo - C.shaft.floor) < 1e-6, `between ${lo} and ${hi}`);
    assert.ok(Math.abs(causticShaft(700, 300, 5) - causticShaft(700 + C.period, 300, 5)) < 1e-9, 'x can be wrapped to the period');
    for (const n of C.cells) assert.equal(n % 2, 0, 'even cell counts keep the warp seamless at the wrap');
});

test('a lit face that looks up catches the net; a dark crevice or a face that looks down does not', async () => {
    const { causticCatch } = await import('../game/fx/causticsMath.js');
    assert.equal(causticCatch(0.7, 0.7), 1);
    assert.equal(causticCatch(0.05, 0.05), 0);
    assert.ok(causticCatch(0.7, 0.8) < causticCatch(0.7, 0.7), 'brighter below = it faces down');
    assert.equal(causticCatch(0.7, 0.3), 1, 'darker below = it faces up');
});
