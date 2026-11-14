// Music clock (pure, no Phaser, no Web Audio): one shared tempo with beat and bar
// phase. Visual animation locks to it (things bop on the beat, Nintendo style);
// gameplay physics never does. Tempo changes wait for the next bar line so the
// music never stumbles. Times are in seconds on any steady time base.

export const CLOCK = {
    bpm: 96,          // default tempo, also used when the music is off
    beatsPerBar: 4,
    minBpm: 40,
    maxBpm: 200
};

export function createClock({ bpm = CLOCK.bpm, beatsPerBar = CLOCK.beatsPerBar, t = 0 } = {}) {
    // The current segment: from time t0 the clock counts beats from beat0 at bpm.
    let t0 = t, beat0 = 0, rate = clampBpm(bpm) / 60, pending = null;

    const beatAt = time => beat0 + (time - t0) * rate;

    /** Apply a waiting tempo change once its bar line has passed. */
    function settle(time) {
        if (pending && time >= pending.at) {
            beat0 = beatAt(pending.at);
            t0 = pending.at;
            rate = pending.bpm / 60;
            pending = null;
        }
    }

    return {
        get bpm() { return rate * 60; },
        beatsPerBar,

        /** Ask for a new tempo; it starts on the next bar line after `time`. */
        setTempo(newBpm, time) {
            settle(time);
            const b = beatAt(time);
            const nextBar = Math.ceil(b / beatsPerBar - 1e-9) * beatsPerBar;
            pending = { bpm: clampBpm(newBpm), at: t0 + (nextBar - beat0) / rate };
            if (pending.bpm === rate * 60) pending = null;
        },

        /** Where the music is at `time`. */
        phase(time) {
            settle(time);
            const beat = beatAt(time);
            const bar = Math.floor(beat / beatsPerBar);
            return {
                beat,                                   // total beats so far (float)
                beatPhase: beat - Math.floor(beat),     // 0 on the beat, rising to 1
                beatInBar: Math.floor(beat) - bar * beatsPerBar,
                bar,
                barPhase: beat / beatsPerBar - bar      // 0 on the downbeat
            };
        },

        /** Seconds from `time` to the next grid line (division = steps per beat, 4 = 1/16 notes). */
        untilGrid(time, division = 4) {
            settle(time);
            const step = beatAt(time) * division;
            const next = Math.ceil(step - 1e-9);
            return Math.max(0, (next - step) / division / rate);
        },

        /**
         * A 0..1 pulse that peaks on every beat and decays before the next one, for
         * bobbing and glowing. `sharp` > 1 makes it snappier.
         */
        pulse(time, sharp = 3) {
            const { beatPhase } = this.phase(time);
            return Math.exp(-beatPhase * sharp);
        },

        /** Same as pulse(), but once per bar (accent on the downbeat). */
        barPulse(time, sharp = 4) {
            const { barPhase } = this.phase(time);
            return Math.exp(-barPhase * sharp);
        }
    };
}

function clampBpm(bpm) {
    return Math.min(CLOCK.maxBpm, Math.max(CLOCK.minBpm, Number(bpm) || CLOCK.bpm));
}
