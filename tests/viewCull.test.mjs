import test from 'node:test';
import assert from 'node:assert/strict';
import { VIEW_CULL, touchesView, reachOf, cullToView } from '../game/viewCull.js';

const view = { centerX: 1000, centerY: 500, width: 1920, height: 1080 };
const img = (x, y, w = 100, h = 100, extra = {}) => ({ type: 'Image', x, y, displayWidth: w, displayHeight: h, scrollFactorX: 1, scrollFactorY: 1, cameraFilter: 0, ...extra });

test('what touches the view (with its own reach) counts as in it', () => {
    assert.equal(touchesView(1000, 500, 0, 1000, 500, 960, 540), true);
    assert.equal(touchesView(1000 + 960 + 49, 500, 50, 1000, 500, 960, 540), true);
    assert.equal(touchesView(1000 + 960 + 51, 500, 50, 1000, 500, 960, 540), false);
    assert.equal(touchesView(1000, 500 - 540 - 60, 50, 1000, 500, 960, 540), false);
});

test('reach: a picture’s diagonal, a rope’s farthest point and width (worked out once)', () => {
    assert.equal(reachOf(img(0, 0, 300, 400)), 500);
    const rope = { type: 'Rope', points: [{ x: 0, y: -200 }, { x: 30, y: 200 }], scaleX: 1, scaleY: 2, frame: { height: 20 } };
    const r = reachOf(rope);
    assert.ok(r > 400 && r < 620);
    rope.points[1].y = 9999;
    assert.equal(reachOf(rope), r, 'kept');
});

test('objects outside the view are taken off the camera and put back when they come in; visible is never touched', () => {
    const far = img(5000, 500), near = img(1000 + 960 + VIEW_CULL.pad + 20, 500, 100, 100), inside = img(900, 400), hidden = img(900, 400, 100, 100, { visible: false });
    const big = img(3200, 500, 3000, 200);      // its middle is far outside, but it reaches into the view
    const list = [far, near, inside, hidden, big];
    assert.equal(cullToView(list, view, 1), 1);
    assert.equal(far.cameraFilter, 1);
    assert.equal(near.cameraFilter, 0, 'within the margin and its own reach');
    assert.equal(inside.cameraFilter, 0);
    assert.equal(big.cameraFilter, 0);
    assert.equal(hidden.visible, false);
    far.x = 1200;
    assert.equal(cullToView(list, view, 1), 0);
    assert.equal(far.cameraFilter, 0, 'back in view: drawn again');
});

test('only objects at their own place in the world are judged, and another camera’s filter is kept', () => {
    const hud = img(5000, 500, 100, 100, { scrollFactorX: 0, scrollFactorY: 0 });
    const box = { type: 'Container', x: 5000, y: 500, scrollFactorX: 1, scrollFactorY: 1, cameraFilter: 0 };
    const pinned = img(5000, 500, 100, 100, { noCull: true });
    const other = img(5000, 500, 100, 100, { cameraFilter: 4 });
    cullToView([hud, box, pinned, other], view, 1);
    assert.deepEqual([hud.cameraFilter, box.cameraFilter, pinned.cameraFilter, other.cameraFilter], [0, 0, 0, 5]);
    other.x = 1000;
    cullToView([other], view, 1);
    assert.equal(other.cameraFilter, 4, 'the other camera’s bit stays');
});
