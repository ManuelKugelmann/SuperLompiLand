import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomCore, RELAY, parseFrame, validRoom, Bucket, originAllowed } from '../worker/relay/lib.js';
import { deriveKeys } from '../net/keys.js';

const state = { n: 1, t: 5, x: 10, y: 20, vx: 0.5, vy: -1, s: 'normal', f: 1, c: 'lompi' };

function room(clock = { t: 0 }) {
    const sent = new Map(), closed = new Set();
    let next = 0;
    const core = new RoomCore({
        send: (c, o) => { if (!sent.has(c)) sent.set(c, []); sent.get(c).push(o); },
        close: c => closed.add(c),
        now: () => clock.t,
        makeId: () => `p${++next}`
    });
    return { core, sent, closed, clock };
}

test('join: hello with your id and who is here; others hear about you', () => {
    const { core, sent } = room();
    const a = {}, b = {};
    core.connect(a);
    core.connect(b);
    assert.deepEqual(sent.get(a)[0], { k: 'hello', id: 'p1', peers: [] });
    assert.deepEqual(sent.get(b)[0], { k: 'hello', id: 'p2', peers: ['p1'] });
    assert.deepEqual(sent.get(a)[1], { k: 'join', id: 'p2' });
});

test('state and emotes are forwarded to the others only, tagged with the sender', () => {
    const { core, sent } = room();
    const a = {}, b = {}, c = {};
    [a, b, c].forEach(x => core.connect(x));
    core.message(a, JSON.stringify({ k: 's', d: state }));
    core.message(a, JSON.stringify({ k: 'e', d: 'heart' }));
    for (const x of [b, c]) {
        assert.deepEqual(sent.get(x).at(-2), { k: 's', from: 'p1', d: state });
        assert.deepEqual(sent.get(x).at(-1), { k: 'e', from: 'p1', d: 'heart' });
    }
    assert.ok(!sent.get(a).some(m => m.k === 's' || m.k === 'e'), 'no echo');
});

test('a fifth fish is turned away', () => {
    const { core, sent, closed } = room();
    const conns = Array.from({ length: RELAY.maxPeers + 1 }, () => ({}));
    conns.forEach(c => core.connect(c));
    const last = conns.at(-1);
    assert.deepEqual(sent.get(last), [{ k: 'full' }]);
    assert.ok(closed.has(last));
    assert.equal(core.peers.size, RELAY.maxPeers);
});

test('leaving tells the others', () => {
    const { core, sent } = room();
    const a = {}, b = {};
    core.connect(a); core.connect(b);
    core.disconnect(a);
    assert.deepEqual(sent.get(b).at(-1), { k: 'leave', id: 'p1' });
});

test('junk is never forwarded, and a client that keeps sending it is dropped', () => {
    const { core, sent, closed } = room();
    const a = {}, b = {};
    core.connect(a); core.connect(b);
    const before = sent.get(b).length;
    const junk = ['', 'nope', '{"k":"chat","d":"hi"}', JSON.stringify({ k: 'e', d: 'hello there' }),
        JSON.stringify({ k: 's', d: { ...state, x: 'far' } }), JSON.stringify({ k: 's', d: { ...state, c: 'x'.repeat(99) } }), 'x'.repeat(5000)];
    for (let i = 0; i < RELAY.strikes; i++) core.message(a, junk[i % junk.length]);
    assert.equal(sent.get(b).length, before + 1, 'only the leave notice reached b');
    assert.deepEqual(sent.get(b).at(-1), { k: 'leave', id: 'p1' });
    assert.ok(closed.has(a));
});

test('flooding is rate limited', () => {
    const clock = { t: 0 };
    const { core, sent } = room(clock);
    const a = {}, b = {};
    core.connect(a); core.connect(b);
    const before = sent.get(b).length;
    for (let i = 0; i < 200; i++) core.message(a, JSON.stringify({ k: 's', d: { ...state, n: i } }));
    const got = sent.get(b).length - before;
    assert.ok(got <= RELAY.burst + 1 && got >= RELAY.burst - 1, `burst forwarded ${got}`);
    // a steady 20 Hz stream is never limited
    const b2 = new Bucket(0);
    for (let i = 0; i < 2000; i++) assert.ok(b2.take(i * 50));
});

test('frames and room ids are checked', () => {
    assert.deepEqual(parseFrame(JSON.stringify({ k: 's', d: { ...state, extra: 'dropped' } })), { k: 's', d: state });
    assert.equal(parseFrame(JSON.stringify({ k: 's', d: { ...state, vx: null } })), null);
    assert.equal(parseFrame(JSON.stringify({ k: 's', d: { ...state, x: Infinity } })), null);
    assert.ok(validRoom('a'.repeat(48)));
    for (const bad of ['', 'xyz', '../etc', 'A'.repeat(48), 'a'.repeat(200)]) assert.equal(validRoom(bad), false);
    assert.equal(originAllowed('https://evil.example', 'https://good.example'), false);
    assert.equal(originAllowed('https://good.example', 'https://a.example, https://good.example'), true);
});

test('a socket restored after hibernation keeps its id and can talk again', () => {
    const { core, sent } = room();
    const a = {}, b = {};
    core.adopt(a, 'old-a');
    core.connect(b);
    core.message(a, JSON.stringify({ k: 'e', d: 'wave' }));
    assert.deepEqual(sent.get(b).at(-1), { k: 'e', from: 'old-a', d: 'wave' });
});

test('room keys: same name -> same keys; the hash fits the relay; the name is not in them', async () => {
    const k1 = await deriveKeys('kekssotterpirat'), k2 = await deriveKeys('kekssotterpirat'), k3 = await deriveKeys('kekssotterpirad');
    assert.deepEqual(k1, k2);
    assert.notEqual(k1.room, k3.room);
    assert.ok(validRoom(k1.room));
    assert.ok(!k1.room.includes('keks') && !k1.password.includes('keks'));
    assert.notEqual(k1.room, k1.password.slice(0, 48));
});
