// A short scripted sequence (pure, no Phaser): beats at fixed times that play by themselves,
// and a way to jump to the next beat at once (one tap = one beat on, never the whole sequence).

/**
 * `beats` = [{ at (ms from the start), run() }], in order. Returns
 *   step(ms)   let time pass: every beat that is due runs (in order)
 *   next()     jump to the next beat that has not run yet and run it; false when none is left
 *   done       true once every beat has run
 */
export function createTimeline(beats) {
    let clock = 0, i = 0;
    const due = () => { while (i < beats.length && beats[i].at <= clock) beats[i++].run(); };
    return {
        get done() { return i >= beats.length; },
        get clock() { return clock; },
        step(ms) { clock += ms; due(); },
        next() {
            if (i >= beats.length) return false;
            clock = Math.max(clock, beats[i].at);
            due();
            return true;
        }
    };
}
