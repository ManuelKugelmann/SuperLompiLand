// Where the face is in each painted picture (pure data, keyed by texture key): the eyes that get
// living eyes (rig/RigEyes.js) and the mouth a breath's bubble leaves from (CardRig, Rig). Any rig
// showing that picture uses them, so a playable, the same animal as a rescued friend and a wild
// creature all look alive the same way. Picture px of the full picture:
//   eyes: { iris, lid (colours 0xRRGGBB), at: [{ x, y, rx, ry }] }  middle and half sizes of each eye
//         that faces the viewer (one on the silhouette's edge stays painted)
//         (bead: 0xRRGGBB instead of iris: a glossy bead eye; pupil: pupil size factor, bigger reads kinder)
//   mouth: { x, y }
export const FACES = {
    puffer_normal: { eyes: { iris: 0x3f9fb0, lid: 0xeee27a, at: [{ x: 372, y: 117, rx: 50, ry: 52 }] }, mouth: { x: 470, y: 172 } },
    puffer_inflated: { eyes: { iris: 0x3f9fb0, lid: 0xf1e889, at: [{ x: 232, y: 182, rx: 52, ry: 56 }, { x: 405, y: 152, rx: 38, ry: 48 }] }, mouth: { x: 340, y: 228 } },
    player_shark: { eyes: { iris: 0x2c64c8, lid: 0x8d98a8, at: [{ x: 350, y: 175, rx: 33, ry: 31 }] }, mouth: { x: 395, y: 245 } },
    player_flyingfish: { eyes: { iris: 0x2f9a98, lid: 0x9fb2dc, at: [{ x: 432, y: 128, rx: 30, ry: 27 }] }, mouth: { x: 478, y: 163 } },
    player_firefish: { eyes: { iris: 0x2a78c8, lid: 0xf4a24a, at: [{ x: 402, y: 233, rx: 41, ry: 41 }] }, mouth: { x: 448, y: 292 } },
    friend_turtle: { eyes: { iris: 0x2a86c8, lid: 0xc9d65a, at: [{ x: 390, y: 63, rx: 38, ry: 38 }] }, mouth: { x: 432, y: 132 } },
    friend_parrotfish: { eyes: { iris: 0x6a2c22, lid: 0xe26a86, at: [{ x: 404, y: 131, rx: 38, ry: 40 }] }, mouth: { x: 470, y: 222 } },
    friend_grouper: { eyes: { iris: 0xc8781e, lid: 0xf0a050, at: [{ x: 378, y: 148, rx: 33, ry: 36 }] }, mouth: { x: 470, y: 215 } },
    friend_jellyfish: { eyes: { iris: 0x2a6fd0, lid: 0xf3d8ef, pupil: 1.15, at: [{ x: 70, y: 158, rx: 21, ry: 23 }, { x: 151, y: 117, rx: 25, ry: 27 }] }, mouth: { x: 125, y: 170 } },
    friend_seahorse: { eyes: { iris: 0x2a90c0, lid: 0xf7c23a, pupil: 1.1, at: [{ x: 192, y: 138, rx: 30, ry: 32 }] }, mouth: { x: 300, y: 158 } },
    friend_starfish: { eyes: { bead: 0x1c120e, lid: 0xff9a2a, at: [{ x: 190, y: 175, rx: 26, ry: 26 }, { x: 300, y: 147, rx: 26, ry: 26 }] } },
    urchin: { eyes: { bead: 0x16101c, lid: 0xb898e0, at: [{ x: 196, y: 211, rx: 27, ry: 27 }, { x: 316, y: 211, rx: 27, ry: 27 }] } }
};

/** The face of a look: its own (`face` in a profile's state) or its picture's. */
export const faceOf = st => st.face ?? FACES[st.key] ?? null;
