import test from 'node:test';
import assert from 'node:assert/strict';
import { SHADE, shadeChunk } from '../game/level/shade.js';
import { FIELD, createField } from '../game/level/density.js';

const field = createField(1337);
const SPAN = 960, S = SHADE.rockSize;
// A chunk of the home reef that holds both water and rock.
const OX = 0, OY = 960;
const pic = shadeChunk(field, 1337, OX, OY, SPAN);
const at = (img, size, px, py) => Array.from(img.subarray((py * size + px) * 4, (py * size + px) * 4 + 4));
const world = (px, py) => [OX + (px + 0.5) * SPAN / S, OY + (py + 0.5) * SPAN / S];

test('pictures have the configured sizes', () => {
    assert.equal(pic.rock.length, S * S * 4);
    assert.equal(pic.back.length, SHADE.backSize * SHADE.backSize * 4);
});

test('rock is opaque well inside the rock and clear well inside the water', () => {
    let solid = 0, open = 0;
    for (let py = 8; py < S; py += 16) {
        for (let px = 8; px < S; px += 16) {
            const d = field.density(...world(px, py)), a = at(pic.rock, S, px, py)[3];
            if (d > FIELD.threshold + 0.03) { assert.equal(a, 255, `opaque at ${px},${py}`); solid++; }
            if (d < FIELD.threshold - 0.03) { assert.equal(a, 0, `clear at ${px},${py}`); open++; }
        }
    }
    assert.ok(solid > 20 && open > 20, `chunk has both rock (${solid}) and water (${open})`);
});

test('shading is smooth: no jumps between neighbouring pixels inside the rock', () => {
    let worst = 0;
    for (let py = 1; py < S; py++) {
        for (let px = 1; px < S; px++) {
            const o = (py * S + px) * 4;
            if (pic.rock[o + 3] < 255 || pic.rock[o - 1] < 255 || pic.rock[o - S * 4 + 3] < 255) continue;
            for (let c = 0; c < 3; c++) {
                worst = Math.max(worst, Math.abs(pic.rock[o + c] - pic.rock[o - 4 + c]), Math.abs(pic.rock[o + c] - pic.rock[o - S * 4 + c]));
            }
        }
    }
    assert.ok(worst < 40, `largest step between neighbours: ${worst}`);
});

test('neighbouring chunks meet without a seam', () => {
    const right = shadeChunk(field, 1337, OX + SPAN, OY, SPAN);
    let worst = 0, compared = 0;
    for (let py = 0; py < S; py++) {
        const a = at(pic.rock, S, S - 1, py), b = at(right.rock, S, 0, py);
        if (a[3] < 255 || b[3] < 255) continue;
        compared++;
        for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(a[c] - b[c]));
    }
    assert.ok(compared > 20 && worst < 40, `seam step ${worst} over ${compared} pixels`);
});

test('faces looking up are brighter than faces looking down', () => {
    // Floors come from the test chunk; for ceilings find a chunk with a real
    // overhang by probing the field (cheap), then shade that one too.
    const T = FIELD.threshold, isCeiling = (x, y) => field.density(x, y) > T && field.density(x, y + 40) < T - 0.02;
    let cave = null;
    for (let cx = 0; cx < 30 && !cave; cx++) {
        for (let cy = 1; cy < 5 && !cave; cy++) {
            let n = 0;
            for (let x = 30; x < SPAN; x += 60) for (let y = 30; y < SPAN; y += 40) if (isCeiling(cx * SPAN + x, cy * SPAN + y)) n++;
            if (n >= 6) cave = [cx * SPAN, cy * SPAN];
        }
    }
    assert.ok(cave, 'the world has overhangs');
    let up = 0, upN = 0, down = 0, downN = 0;
    for (const [ox, oy, img] of [[OX, OY, pic.rock], [...cave, shadeChunk(field, 1337, ...cave, SPAN).rock]]) {
        for (let py = 2; py < S - 2; py += 2) {
            for (let px = 2; px < S - 2; px += 2) {
                const x = ox + (px + 0.5) * SPAN / S, y = oy + (py + 0.5) * SPAN / S;
                const d = field.density(x, y);
                if (d < T + 0.002 || d > T + 0.02) continue;             // just inside the rim
                const slope = field.density(x, y + 6) - field.density(x, y - 6);
                const [r, g, b] = at(img, S, px, py);
                if (slope > 0.006) { up += r + g + b; upN++; }           // rock below = a floor
                if (slope < -0.006) { down += r + g + b; downN++; }      // rock above = a ceiling
            }
        }
    }
    assert.ok(upN > 10 && downN > 10, `floors ${upN}, ceilings ${downN}`);
    assert.ok(up / upN > 1.5 * down / downN, `floor ${up / upN | 0} vs ceiling ${down / downN | 0}`);
});

test('the water next to rock is shaded, open water is left alone', () => {
    const B = SHADE.backSize;
    let near = 0, nearN = 0;
    for (let py = 2; py < B; py += 4) {
        for (let px = 2; px < B; px += 4) {
            const d = field.density(OX + (px + 0.5) * SPAN / B, OY + (py + 0.5) * SPAN / B);
            const a = at(pic.back, B, px, py)[3];
            if (d < FIELD.threshold - 0.25) assert.equal(a, 0, `open water at ${px},${py}`);
            if (d > FIELD.threshold - 0.01 && d < FIELD.threshold) { near += a; nearN++; }
        }
    }
    assert.ok(nearN > 3 && near / nearN > 40, `shade next to rock: ${near / nearN}`);
});
