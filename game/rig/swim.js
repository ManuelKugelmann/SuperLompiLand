// Swimming without keyframes: the motion of a fish as a function of how fast it
// goes, how hard it pushes and where it turns. One driver, a few numbers per way
// of swimming; the rig turns the channels into bends and fin angles.
// Pure and deterministic (tests/swim.test.mjs).
//
// Timing follows what real swimmers do: the beat frequency grows with speed and
// shrinks with size, f = St * U / A (Strouhal number St around 0.2-0.4, U speed,
// A tail-beat amplitude). When the fish stops pushing it glides: the beat fades
// out, the fins trim.

export const SWIM = {
    // Boxfish and puffers: a rigid body. The dorsal and anal fins ripple, the
    // pectorals row, the tail is mostly a rudder and only beats in a sprint.
    ostraciiform: {
        strouhal: 0.3, amplitude: 0.1,        // amplitude in body lengths
        hz: [1.4, 7],                         // slowest and fastest beat
        tailBeat: 0.12, tailSprint: 0.45,     // tail swing (radians) while cruising / at full push
        rudder: 0.6,                          // tail deflection (radians) at full turn
        sway: 0.03,                           // body yaw with the beat (radians)
        pectoral: 0.55, pectoralRest: 0.14,   // rowing stroke (radians) at full push / idle sculling
        ripple: 1, rippleRest: 0.35,          // dorsal/anal ripple strength while pushing / idle
        glide: 2.2                            // how fast the beat fades once the push stops (per second)
    },
    // Most fish: a wave runs down the back third of the body into the tail.
    carangiform: {
        strouhal: 0.3, amplitude: 0.18, hz: [1, 6],
        tailBeat: 0.35, tailSprint: 0.6, rudder: 0.25, sway: 0.08,
        pectoral: 0.12, pectoralRest: 0.1, ripple: 0.2, rippleRest: 0.1, glide: 1.6
    }
};

/** Beat frequency (Hz) for a speed in body lengths per second. */
export function beatHz(mode, speed) {
    const f = mode.strouhal * Math.max(0, speed) / mode.amplitude;
    return Math.min(mode.hz[1], Math.max(mode.hz[0], f));
}

export class Swimmer {
    constructor(mode = SWIM.ostraciiform) {
        this.mode = mode;
        this.phase = 0;        // beat cycle, radians, always advancing
        this.power = 0;        // 0 = gliding or resting .. 1 = full push (smoothed)
        this.tail = 0;         // tail angle, radians (+ = toward the viewer's left side of the fish)
        this.sway = 0;         // body yaw with the beat
        this.pectoral = 0;     // pectoral fin stroke angle
        this.spread = 0;       // how far the pectorals stand off the body (braking flare)
        this.ripple = 0;       // strength of the dorsal/anal ripple; its phase is `phase`
        this.gliding = false;
    }

    /**
     * @param dt       seconds
     * @param o.speed  body lengths per second
     * @param o.push   0..1 how hard the fish is swimming right now
     * @param o.turn   -1..1 steering
     * @param o.brake  0..1 braking (pectorals flare out)
     */
    update(dt, { speed = 0, push = 0, turn = 0, brake = 0 } = {}) {
        const m = this.mode;
        // The push builds quickly and fades at the glide rate.
        const rate = push > this.power ? 9 : m.glide;
        this.power += (push - this.power) * (1 - Math.exp(-rate * dt));
        this.gliding = this.power < 0.12 && speed > 0.3;
        // The phase always runs on, so changing speed never makes the motion jump.
        this.phase += beatHz(m, speed) * Math.PI * 2 * dt;
        const beat = Math.sin(this.phase);
        const swing = m.tailBeat * Math.min(1, this.power * 2) + (m.tailSprint - m.tailBeat) * Math.max(0, this.power - 0.5) * 2;
        this.tail = beat * swing + turn * m.rudder;
        this.sway = beat * m.sway * this.power;
        this.pectoral = Math.sin(this.phase + 1.2) * (m.pectoralRest + (m.pectoral - m.pectoralRest) * this.power);
        this.spread = Math.max(brake, 0.25 * (1 - this.power));
        this.ripple = m.rippleRest + (m.ripple - m.rippleRest) * this.power;
        return this;
    }
}
