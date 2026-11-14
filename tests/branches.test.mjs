import test from 'node:test';
import assert from 'node:assert/strict';
import { BRANCH, sideCave, ridgeTop, tunnelHalf, caveAt, caveFlow } from '../game/level/branches.js';
import { BIOMES } from '../game/level/biomes.js';
import { createField, FIELD, ROUTE } from '../game/level/density.js';

const f = createField(1337), cave = sideCave(f.routeY);
const open = (x, y) => f.density(x, y) < FIELD.threshold;

test('the side cave lies on the kelp island, wholly under the calm route', () => {
    const kelp = BIOMES.find(b => b.id === 'kelp');
    assert.ok(cave.x0 > kelp.from + 2000 && cave.x1 < kelp.from + kelp.width - 1500);
    assert.ok(cave.top > cave.ry + ROUTE.halfWidth, 'the ridge begins under the lane');
    assert.ok(cave.y - BRANCH.half > cave.top + 100, 'rock between the lane and the tunnel');
    for (const n of f.nests) assert.ok(Math.abs(n.x - cave.x0) > 1500 && Math.abs(n.x - cave.x1) > 1500, 'clear of the nests');
});

test('the calm route above it stays open all along', () => {
    for (let x = cave.x0 - 800; x <= cave.x1 + 800; x += 50) {
        const y = f.routeY(x);
        for (const dy of [-ROUTE.halfWidth * 0.75, 0, ROUTE.halfWidth * 0.75]) assert.ok(open(x, y + dy), `route at ${x}, ${Math.round(y + dy)}`);
    }
});

test('you can swim in at the mouth, through the tunnel past the net and the clam, and out at the exit', () => {
    for (let y = cave.ry + ROUTE.halfWidth; y <= cave.y; y += 40) { assert.ok(open(cave.x0, y), `mouth at ${y}`); assert.ok(open(cave.x1, y), `exit at ${y}`); }
    for (let x = cave.x0; x <= cave.x1; x += 40) for (const dy of [-80, 0, 80]) assert.ok(open(x, cave.y + dy), `tunnel at ${x}, ${dy}`);
    assert.ok(open(cave.net.x, cave.y + 90), 'a way under the net');
    assert.ok(open(cave.clam.x, cave.clam.y - 60), 'room over the clam');
});

test('it is a cave: rock above and below the tunnel, rock between mouth and exit under the route', () => {
    const mid = (cave.x0 + cave.x1) / 2;
    assert.ok(!open(mid, cave.top + 120), 'roof');
    assert.ok(!open(mid, cave.y + BRANCH.half + 120), 'floor');
    assert.equal(caveAt(cave, mid, cave.y, cave.top), -1);
    assert.equal(caveAt(cave, mid, cave.top + 100, cave.top), 1);
    assert.equal(caveAt(cave, mid, cave.top - 50, cave.top), 0);
    assert.equal(ridgeTop(cave, cave.x0 - 5000), Infinity);
    assert.ok(ridgeTop(cave, cave.x1 + BRANCH.mouth + 300) > cave.top + 300, 'the ridge falls away at its ends');
});

test('the clam has a chamber: the tunnel is higher there than elsewhere', () => {
    assert.ok(tunnelHalf(cave, cave.clam.x) > BRANCH.half + 60);
    assert.equal(tunnelHalf(cave, (cave.x0 + cave.x1) / 2), BRANCH.half);
    assert.equal(tunnelHalf(cave, cave.x0 - BRANCH.mouth - 10), 0);
});

test('the water inside runs east and is still at the walls, at both ends and outside', () => {
    const mid = (cave.x0 + cave.x1) / 2;
    const v = caveFlow(cave, mid, cave.y);
    assert.ok(Math.abs(v.x - BRANCH.current) < 1e-9 && v.y === 0);
    assert.ok(caveFlow(cave, mid, cave.y + BRANCH.half - 10).x < 2);
    assert.equal(caveFlow(cave, cave.x0, cave.y).x, 0);
    assert.equal(caveFlow(cave, mid, cave.ry).x, 0, 'none on the calm route above');
});
