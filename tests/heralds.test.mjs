import test from 'node:test';
import assert from 'node:assert/strict';
import { HERALDS, heraldSpots, heraldDue } from '../game/level/heralds.js';

test('every big animal has a herald with a call', () => {
    const spots = heraldSpots();
    assert.equal(spots.length, Object.keys(HERALDS.calls).length);
    for (const s of spots) assert.ok(Number.isFinite(s.x) && s.call, s.id);
    for (let i = 1; i < spots.length; i++) assert.ok(spots[i].x >= spots[i - 1].x, 'west to east');
});

test('heard once, a little before the animal, never once it is in view', () => {
    const s = heraldSpots()[0], heard = new Set();
    assert.equal(heraldDue(s.x - HERALDS.lead - 10, heard), null, 'too far');
    assert.equal(heraldDue(s.x - HERALDS.lead + 10, heard).id, s.id);
    assert.equal(heraldDue(s.x - HERALDS.late + 10, heard), null, 'already in view');
    heard.add(s.id);
    assert.equal(heraldDue(s.x - HERALDS.lead + 10, heard), null, 'only once');
});
