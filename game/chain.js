// Chains: linking moves (a jump through the surface, a clean landing, a skip off a wave, a
// flip in the air, a special, riding a current, a cannon shot, a pad bounce, finishing a
// coin melody) within a generous
// window builds a chain. It is a soft counter, never a pressure timer: nothing is lost when
// it ends, and it ends with a few bonus coins. From CHAIN.flowAt on the run is "in flow".
//
// Pure rules, no Phaser (tests/chain.test.mjs). Times are ms.

export const CHAIN = {
    window: 4000,       // after a move, the next one within this time continues the chain
    flowAt: 5,          // chain length from which the run counts as flow
    bonusEvery: 3,      // one bonus coin per this many moves when a chain ends
    minLeap: 7,         // speed (px/step) through the surface for a jump to count
    minAir: 350,        // time in the air for the landing to count
    streamSpeed: 6,     // water speed (px/step) that counts as riding a current
    // Radians the flight path must turn one way to count as a flip. A plain jump turns about 2
    // (up, over, down); 3.9 (225 degrees) needs real steering and fits into one jump.
    flipTurn: 3.9,
    // The moves, and how long before the same move counts again (so holding one does not farm it).
    verbs: { leap: 600, landing: 600, skim: 150, flip: 0, special: 700, stream: 3000, trail: 0, cannon: 300, pad: 300 }
};

/** Bonus coins for a finished chain of this length. */
export function bonusFor(count, cfg = CHAIN) {
    return Math.floor(count / cfg.bonusEvery);
}

export function createChain(cfg = CHAIN) {
    let count = 0, lastAt = -Infinity, last = null;
    const seen = {};
    const finish = () => {
        const done = count > 0 ? { count, bonus: bonusFor(count, cfg) } : null;
        count = 0; last = null;
        for (const k in seen) delete seen[k];
        return done;
    };
    return {
        get count() { return count; },
        get last() { return last; },
        get flow() { return count >= cfg.flowAt; },
        /** A move happened. Returns { count, verb, flow, entered } or null when it does not count. */
        add(verb, now) {
            if (!(verb in cfg.verbs)) return null;
            if (now - (seen[verb] ?? -Infinity) < cfg.verbs[verb]) return null;
            if (now - lastAt > cfg.window) finish();
            seen[verb] = now; lastAt = now; last = verb;
            count++;
            return { count, verb, flow: count >= cfg.flowAt, entered: count === cfg.flowAt };
        },
        /** Call regularly: returns { count, bonus } once when the chain has run out, else null. */
        tick(now) {
            return count > 0 && now - lastAt > cfg.window ? finish() : null;
        },
        /** End the chain now (e.g. after a bump); returns { count, bonus } or null. */
        end: finish
    };
}

/**
 * Counts flips: feed it the flight heading every step while in the air; `turn` returns 1
 * each time the path has turned cfg.flipTurn in one direction, else 0.
 */
export function createSpin(cfg = CHAIN) {
    let prev = null, total = 0;
    return {
        turn(angle) {
            if (prev !== null) {
                const d = angle - prev;
                total += Math.atan2(Math.sin(d), Math.cos(d));
            }
            prev = angle;
            if (Math.abs(total) < cfg.flipTurn) return 0;
            total -= Math.sign(total) * cfg.flipTurn;
            return 1;
        },
        reset() { prev = null; total = 0; }
    };
}
