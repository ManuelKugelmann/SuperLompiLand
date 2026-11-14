import test from 'node:test';
import assert from 'node:assert/strict';
import { SKYLINE, skyItems, screenX, onScreen, volcanoAt } from '../game/level/skyline.js';
import { BIOMES, WORLD_WEST, WORLD_END, biomeIndexAt } from '../game/level/biomes.js';

const W = 1920;

test('every biome has something on its horizon, anchored inside it', () => {
    const items = skyItems();
    for (const b of BIOMES) assert.ok(items.some(i => BIOMES[biomeIndexAt(i.x)].id === b.id), b.id);
    for (const i of items) assert.ok(i.scroll > 0 && i.scroll < 0.3 && i.size > 0, 'far and soft: slow parallax');
});

test('a shape is in the middle of the screen when the camera is at its anchor', () => {
    for (const i of skyItems()) assert.equal(screenX(i, i.x, W), W / 2);
});

test('shapes pass slowly: far ones move less than near ones', () => {
    const [near, far] = [{ x: 0, scroll: 0.14 }, { x: 0, scroll: 0.05 }];
    assert.ok(Math.abs(screenX(near, 1000, W) - W / 2) > Math.abs(screenX(far, 1000, W) - W / 2));
});

test('on screen includes a margin, so nothing pops at the edge', () => {
    assert.ok(onScreen(-200, 250, W));
    assert.ok(!onScreen(-200 - 250 - SKYLINE.margin, 200, W));
    assert.ok(onScreen(W + 200, 250, W));
});

test('the volcano is in sight from the west end and reaches the middle, full size, in the east', () => {
    const a = volcanoAt(WORLD_WEST, W), b = volcanoAt(WORLD_END, W), mid = volcanoAt((WORLD_WEST + WORLD_END) / 2, W);
    assert.ok(a.x > W / 2 && a.x < W, 'right of the middle, on screen');
    assert.equal(b.x, W / 2);
    assert.equal(b.size, SKYLINE.volcanoGrow[1]);
    assert.ok(a.size < mid.size && mid.size < b.size);
    assert.ok(a.x > mid.x && mid.x > b.x, 'it comes closer steadily');
});
