import test from 'node:test';
import assert from 'node:assert/strict';
import { LIGHT, skyAt, lightAt } from '../game/level/light.js';

const luma = c => 0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255);
const rgb = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

test('the sky cycles very gradually: no jump between two seconds, night darker than day but playable', () => {
    let worst = 0;
    for (let t = 0; t < LIGHT.dayS; t += 1) {
        const a = skyAt(t), b = skyAt(t + 1);
        worst = Math.max(worst, Math.abs(luma(a.color) * a.strength - luma(b.color) * b.strength));
    }
    assert.ok(worst < 3, `largest change per second ${worst.toFixed(2)}`);
    const day = skyAt(LIGHT.dayS * 0.2), night = skyAt(LIGHT.dayS * 0.78);
    assert.ok(night.strength < day.strength && night.strength >= 0.55);
});

test('near the surface the sky colours the light; deep down it does not; depth darkens', () => {
    const sunset = LIGHT.dayS * 0.6;
    const top = lightAt({ y: 50, t: sunset }), deep = lightAt({ y: 3000, t: sunset });
    assert.ok(rgb(top)[0] > rgb(top)[2], 'sunset warms the shallows');
    assert.ok(Math.abs(rgb(deep)[0] - rgb(deep)[2]) < 30, 'deep down the sunset is gone');
    assert.ok(luma(lightAt({ y: 3000, depth01: 1 })) < luma(lightAt({ y: 3000, depth01: 0 })) * 0.5);
});

test('tint stays gentle; the seabed bounces its colour up close above it; a storm greys the surface', () => {
    const plain = lightAt({ y: 600, t: 0 }), green = lightAt({ y: 600, t: 0, hue: 0x2f9a5c });
    assert.ok(luma(green) > luma(plain) * 0.75, 'a biome hue never darkens much');
    const near = lightAt({ y: 600, floorGap: 50, ground: 0xffd080 }), far = lightAt({ y: 600, floorGap: 2000, ground: 0xffd080 });
    assert.ok(rgb(near)[2] < rgb(far)[2], 'warm sand below shows near the floor');
    const storm = lightAt({ y: 50, t: 0, storm: 1 }), calm = lightAt({ y: 50, t: 0 });
    const sat = c => Math.max(...rgb(c)) - Math.min(...rgb(c));
    assert.ok(sat(storm) <= sat(calm) + 2, 'overcast, not coloured');
});

test('night share: none by day, full at night, partway at sunset; it never jumps', async () => {
    const { nightShare } = await import('../game/level/light.js');
    assert.equal(nightShare(LIGHT.dayS * 0.2), 0);
    assert.equal(nightShare(LIGHT.dayS * 0.72), 1);
    let worst = 0;
    for (let t = 0; t < LIGHT.dayS; t++) worst = Math.max(worst, Math.abs(nightShare(t + 1) - nightShare(t)));
    assert.ok(worst < 0.05, `largest step ${worst}`);
});
