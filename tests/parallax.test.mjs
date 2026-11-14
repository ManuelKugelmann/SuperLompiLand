import test from 'node:test';
import assert from 'node:assert/strict';
import { PARALLAX, farY, surfaceBand } from '../game/level/parallax.js';

test('a far thing moves less than the world, the same share every step, and stands at its base at rest', () => {
    const k = PARALLAX.farSea, rest = PARALLAX.farSeaRest;
    assert.equal(farY(1100, rest, k, rest), 1100);
    const a = farY(1100, rest + 1000, k, rest), b = farY(1100, rest + 2000, k, rest);
    assert.equal(1100 - a, 1000 * k, 'it rises as the camera dives, by its share');
    assert.equal(a - b, 1000 * k, 'no clamp: it keeps moving at every depth');
    assert.ok(farY(1100, rest - 400, k, rest) > 1100, 'and sinks as the camera climbs');
});

test('the far surface: at the top edge as the near sea leaves the picture, still there a screen down, gone deep', () => {
    const S = PARALLAX.surface;
    assert.equal(surfaceBand(S.from).top, 0);
    const oneDown = surfaceBand(S.from + 1080);
    assert.ok(oneDown.top < 0 && oneDown.top + S.band > 0 && oneDown.alpha > 0, 'a screen down it still shows at the top');
    assert.ok(surfaceBand(S.from + 1080).alpha < surfaceBand(S.from).alpha, 'fading as it goes');
    assert.equal(surfaceBand(S.fadeTo + 10).alpha, 0);
    assert.equal(surfaceBand(-200).alpha, 0, 'not while the camera is up in the air');
});
