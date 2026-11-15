// Where the face is in each painted picture (pure data, keyed by texture key): the eyes that get
// living eyes (rig/RigEyes.js) and the mouth a breath's bubble leaves from (CardRig, Rig). Any rig
// showing that picture uses them, so a playable, the same animal as a rescued friend and a wild
// creature all look alive the same way. Picture px of the full picture:
//   eyes: { iris, lid (colours 0xRRGGBB), at: [{ x, y, rx, ry }] }  middle and half sizes of each eye
//         that faces the viewer (one on the silhouette's edge stays painted); lid = the skin around the eye
//         (not a painted eye-ring: a closed lid in that colour read as a red disc)
//         (bead: 0xRRGGBB instead of iris: a glossy bead eye; pupil: pupil size factor, bigger reads kinder)
//   mouth: { x, y }
export const FACES = {
    puffer_normal: { eyes: { iris: 0x3f9fb0, lid: 0xeee27a, at: [{ x: 372, y: 117, rx: 50, ry: 52 }] }, mouth: { x: 456, y: 176 } },
    puffer_inflated: { eyes: { iris: 0x3f9fb0, lid: 0xf1e889, at: [{ x: 232, y: 182, rx: 52, ry: 56 }, { x: 405, y: 152, rx: 38, ry: 48 }] }, mouth: { x: 340, y: 228 } },
    player_shark: { eyes: { iris: 0x2c64c8, lid: 0x8d98a8, at: [{ x: 350, y: 175, rx: 33, ry: 31 }] }, mouth: { x: 395, y: 245 } },
    player_flyingfish: { eyes: { iris: 0x2f9a98, lid: 0x9fb2dc, at: [{ x: 432, y: 128, rx: 30, ry: 27 }] }, mouth: { x: 478, y: 163 } },
    player_firefish: { eyes: { iris: 0x2a78c8, lid: 0xf4a24a, at: [{ x: 402, y: 233, rx: 41, ry: 41 }] }, mouth: { x: 448, y: 292 } },
    friend_turtle: { eyes: { iris: 0x2a86c8, lid: 0xc9d65a, at: [{ x: 390, y: 63, rx: 38, ry: 38 }] }, mouth: { x: 432, y: 132 } },
    friend_parrotfish: { eyes: { iris: 0x6a2c22, lid: 0xa8dcef, at: [{ x: 404, y: 131, rx: 38, ry: 40 }] }, mouth: { x: 470, y: 222 } },
    friend_grouper: { eyes: { iris: 0xc8781e, lid: 0xf0a050, at: [{ x: 378, y: 148, rx: 33, ry: 36 }] }, mouth: { x: 470, y: 215 } },
    friend_jellyfish: { eyes: { iris: 0x2a6fd0, lid: 0xf3d8ef, pupil: 1.15, at: [{ x: 70, y: 158, rx: 21, ry: 23 }, { x: 151, y: 117, rx: 25, ry: 27 }] }, mouth: { x: 125, y: 170 } },
    friend_seahorse: { eyes: { iris: 0x2a90c0, lid: 0xf7c23a, pupil: 1.1, at: [{ x: 192, y: 138, rx: 30, ry: 32 }] }, mouth: { x: 300, y: 158 } },
    friend_starfish: { eyes: { bead: 0x1c120e, lid: 0xff9a2a, at: [{ x: 190, y: 175, rx: 26, ry: 26 }, { x: 300, y: 147, rx: 26, ry: 26 }] } },
    urchin: { eyes: { bead: 0x16101c, lid: 0xb898e0, at: [{ x: 196, y: 211, rx: 27, ry: 27 }, { x: 316, y: 211, rx: 27, ry: 27 }] } },
    // The big animals: small real eyes, kept as glossy beads that blink and look.
    whale: { eyes: { bead: 0x21170f, lid: 0x5c6168, at: [{ x: 940, y: 128, rx: 17, ry: 12 }] } },
    whale_shark: { eyes: { bead: 0x0e0d0d, lid: 0x2c3548, at: [{ x: 855, y: 108, rx: 9, ry: 9 }] } },
    // The extended cast (pictures only so far: placed once the gamedesigner adds their rows).
    angelfish: { eyes: { iris: 0x6a3410, lid: 0x1e1f2a, at: [{ x: 194, y: 143, rx: 23, ry: 24 }] }, mouth: { x: 238, y: 178 } },
    rockfish: { eyes: { iris: 0x2a7a8a, lid: 0xd8743a, at: [{ x: 271, y: 131, rx: 22, ry: 22 }] }, mouth: { x: 335, y: 165 } },
    flying_squid: { eyes: { bead: 0x1a1220, lid: 0xd890c8, at: [{ x: 304, y: 25, rx: 10, ry: 10 }] } },
    nautilus: { eyes: { iris: 0x6a3e10, lid: 0xf0d8b8, at: [{ x: 279, y: 118, rx: 18, ry: 20 }] } },
    manta: { eyes: { iris: 0x1e2430, lid: 0x2a3040, at: [{ x: 718, y: 135, rx: 13, ry: 14 }] }, mouth: { x: 735, y: 205 } }
};

/** The face of a look: its own (`face` in a profile's state) or its picture's. */
export const faceOf = st => st.face ?? FACES[st.key] ?? null;
