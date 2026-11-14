import test from 'node:test';
import assert from 'node:assert/strict';
import { BRANCH, sideCave, ridgeTop, tunnelHalf, tunnelMid, caveAt, caveFlow } from '../game/level/branches.js';
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
    // Down the funnels (they lean inward as they go down), then along the tunnel's winding middle.
    for (let k = 0; k <= 1; k += 0.1) {
        const y = cave.top + (cave.y - cave.top) * k;
        assert.ok(open(cave.x0 + BRANCH.lean * k, y), `mouth at ${Math.round(y)}`);
        assert.ok(open(cave.x1 - BRANCH.lean * k, y), `exit at ${Math.round(y)}`);
    }
    for (let x = cave.x0 + BRANCH.lean; x <= cave.x1 - BRANCH.lean; x += 40) for (const dy of [-70, 0, 70]) assert.ok(open(x, tunnelMid(cave, x) + dy), `tunnel at ${x}, ${dy}`);
    assert.ok(open(cave.net.x, tunnelMid(cave, cave.net.x) + 80), 'a way under the net');
    assert.ok(open(cave.clam.x, cave.clam.y - 60), 'room over the clam');
});

test('it is a cave: rock above and below the tunnel, rock between mouth and exit under the route', () => {
    const mid = (cave.x0 + cave.x1) / 2;
    assert.ok(!open(mid, cave.top + 120), 'roof');
    assert.ok(!open(mid, cave.y + BRANCH.half + 120), 'floor');
    assert.ok(caveAt(cave, mid, tunnelMid(cave, mid), cave.top) < -100, 'well inside the tunnel');
    assert.ok(caveAt(cave, mid, cave.top + 60, cave.top) > 50, 'well inside the rock');
    assert.equal(caveAt(cave, mid, cave.top - 50, cave.top), null);
    assert.equal(ridgeTop(cave, cave.x0 - 5000), Infinity);
    assert.ok(ridgeTop(cave, cave.x1 + BRANCH.mouth + 300) > cave.top + 300, 'the ridge falls away at its ends');
});

test('the clam has a chamber: the tunnel is higher there than elsewhere', () => {
    assert.ok(tunnelHalf(cave, cave.clam.x) > BRANCH.half + 60);
    const halves = []; for (let x = cave.x0 + 200; x < cave.x0 + 900; x += 30) halves.push(tunnelHalf(cave, x));
    assert.ok(Math.max(...halves) - Math.min(...halves) > 25 && Math.min(...halves) > 120, 'uneven, never too tight');
    const mids = []; for (let x = cave.x0 + 300; x < cave.x1 - 300; x += 30) mids.push(tunnelMid(cave, x));
    assert.ok(Math.max(...mids) - Math.min(...mids) > 50, 'it winds');
    assert.equal(tunnelHalf(cave, cave.x0 - BRANCH.mouth - 10), 0);
});

test('the water inside runs east and is still at the walls, at both ends and outside', () => {
    const mid = (cave.x0 + cave.x1) / 2;
    const v = caveFlow(cave, mid, tunnelMid(cave, mid));
    assert.ok(Math.abs(v.x - BRANCH.current) < 1e-9 && v.y === 0);
    assert.ok(caveFlow(cave, mid, tunnelMid(cave, mid) + tunnelHalf(cave, mid) - 10).x < 2);
    assert.equal(caveFlow(cave, cave.x0, cave.y).x, 0);
    assert.equal(caveFlow(cave, mid, cave.ry).x, 0, 'none on the calm route above');
});
