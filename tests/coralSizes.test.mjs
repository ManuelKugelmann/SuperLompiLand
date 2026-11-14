import test from 'node:test';
import assert from 'node:assert/strict';
import { CORAL_SIZES, coralSize } from '../game/level/coralSizes.js';

test('corals come in many sizes: most small, some medium, a few large; only small ones may stand in front of the fish', () => {
    const n = { small: 0, medium: 0, large: 0 }, N = 10000;
    let min = Infinity, max = 0;
    for (let i = 0; i < N; i++) {
        const c = coralSize((i + 0.5) / N);
        n[c.cls]++;
        min = Math.min(min, c.px); max = Math.max(max, c.px);
        assert.equal(c.front, c.cls === 'small');
    }
    assert.ok(Math.abs(n.small / N - 0.6) < 0.01 && Math.abs(n.medium / N - 0.3) < 0.01 && Math.abs(n.large / N - 0.1) < 0.01, JSON.stringify(n));
    assert.ok(min < CORAL_SIZES.lompi * 0.5 && max > CORAL_SIZES.lompi * 3, `from ${Math.round(min)} to ${Math.round(max)} px`);
    assert.ok(max / min > 6, 'a wide range of sizes');
    assert.ok(coralSize(0.999).px <= CORAL_SIZES.lompi * 3.2 + 1e-9 && coralSize(1).cls === 'large');
});
