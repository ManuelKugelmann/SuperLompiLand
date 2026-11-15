// Where the face is in each painted picture (pure data, keyed by texture key): the eyes that get
// living eyes (rig/RigEyes.js) and the mouth a breath's bubble leaves from (CardRig, Rig). Any rig
// showing that picture uses them, so a playable, the same animal as a rescued friend and a wild
// creature all look alive the same way. Picture px of the full picture:
//   eyes: { iris, lid (colours 0xRRGGBB), pupil (size factor), at: [{ x, y, rx, ry, hole }] } — the hero
//         creatures only (user: "rim around eyes, not goggly; cut out the eyes, eyeballs behind the rims"):
//         `hole` is the eye's own outline inside its painted rim (scripts/fx/eye_holes.py); the picture is
//         cut open there and the living eyeball drawn behind it. x, y, rx, ry: the hole's middle and half
//         sizes. lid = the skin around the eye (a closed lid in an eye-ring's colour read as a red disc)
//   mouth: { x, y }
export const FACES = {
    puffer_normal: { eyes: { iris: 0x3f9fb0, lid: 0xeee27a, at: [{ x: 370, y: 124, rx: 46, ry: 44, hole: [[402,88],[408,103],[413,118],[415,134],[410,149],[398,159],[384,167],[369,166],[353,162],[338,158],[326,150],[324,134],[326,118],[332,103],[343,92],[357,83],[372,80],[388,80]] }] }, mouth: { x: 456, y: 176 } },
    puffer_inflated: { eyes: { iris: 0x3f9fb0, lid: 0xf1e889, at: [{ x: 228, y: 184, rx: 54, ry: 56, hole: [[187,230],[175,215],[176,197],[180,178],[186,159],[198,144],[214,133],[232,128],[252,130],[265,142],[274,160],[281,178],[282,197],[274,215],[259,227],[243,238],[225,239],[206,235]] }, { x: 400, y: 150, rx: 42, ry: 49, hole: [[359,145],[364,130],[370,116],[378,103],[392,101],[406,109],[416,121],[424,134],[431,148],[436,162],[442,177],[437,190],[425,199],[409,197],[395,192],[383,183],[372,171],[362,159]] }] }, mouth: { x: 340, y: 228 } },
    player_shark: { eyes: { iris: 0x2c64c8, lid: 0x8d98a8, at: [{ x: 348, y: 175, rx: 33, ry: 37, hole: [[381,163],[381,176],[381,189],[379,201],[368,208],[356,212],[343,212],[331,208],[320,200],[316,188],[315,175],[316,163],[320,150],[330,143],[342,139],[355,138],[368,141],[375,151]] }] }, mouth: { x: 395, y: 245 } },
    player_flyingfish: { eyes: { iris: 0x2f9a98, lid: 0x9fb2dc, at: [{ x: 426, y: 126, rx: 28, ry: 30, hole: [[398,120],[401,110],[409,103],[418,98],[429,96],[439,97],[449,101],[453,111],[454,121],[454,132],[452,142],[446,150],[438,157],[428,157],[418,153],[409,147],[401,140],[399,131]] }] }, mouth: { x: 478, y: 163 } },
    player_firefish: { eyes: { iris: 0x2a78c8, lid: 0xf4a24a, at: [{ x: 396, y: 229, rx: 42, ry: 46, hole: [[426,259],[414,269],[398,273],[382,275],[368,271],[358,258],[353,243],[353,227],[356,211],[365,198],[378,188],[393,184],[409,183],[425,188],[438,197],[438,213],[437,229],[432,244]] }] }, mouth: { x: 448, y: 292 } },
    friend_turtle: { eyes: { iris: 0x2a86c8, lid: 0xc9d65a, at: [{ x: 391, y: 61, rx: 45, ry: 44, hole: [[393,105],[380,98],[366,91],[355,80],[350,66],[346,52],[351,38],[361,27],[375,22],[390,17],[405,19],[418,26],[427,37],[435,51],[436,66],[430,79],[419,89],[406,97]] }] }, mouth: { x: 432, y: 132 } },
    friend_parrotfish: { eyes: { iris: 0x6a2c22, lid: 0xa8dcef, at: [{ x: 404, y: 131, rx: 46, ry: 48, hole: [[413,179],[396,179],[381,174],[370,162],[361,148],[358,131],[360,115],[367,100],[380,89],[395,83],[412,83],[427,88],[439,100],[446,115],[450,131],[448,147],[441,162],[428,173]] }] }, mouth: { x: 470, y: 222 } },
    friend_grouper: { mouth: { x: 470, y: 215 } },
    friend_jellyfish: { eyes: { iris: 0x2a6fd0, lid: 0xf3d8ef, pupil: 1.15, at: [{ x: 65, y: 156, rx: 19, ry: 22, hole: [[46,161],[48,154],[49,146],[52,140],[57,135],[64,134],[71,138],[76,142],[80,149],[83,156],[84,163],[83,170],[78,175],[71,177],[63,178],[56,179],[51,175],[47,168]] }, { x: 152, y: 114, rx: 22, ry: 24, hole: [[130,107],[132,99],[137,93],[145,90],[153,91],[161,94],[166,100],[170,107],[172,115],[173,123],[173,131],[166,136],[158,139],[150,139],[143,135],[137,130],[132,123],[130,115]] }] }, mouth: { x: 125, y: 170 } },
    friend_seahorse: { eyes: { iris: 0x2a90c0, lid: 0xf7c23a, pupil: 1.1, at: [{ x: 185, y: 136, rx: 28, ry: 30, hole: [[157,147],[157,136],[158,126],[162,116],[169,108],[179,105],[190,105],[200,108],[207,115],[212,125],[213,135],[213,146],[209,156],[202,163],[191,166],[181,165],[170,162],[162,156]] }] }, mouth: { x: 300, y: 158 } },
    // Other animals keep their painted eyes (user: living eyes only for the hero creatures); their mouths let breaths out.
    angelfish: { mouth: { x: 238, y: 178 } },
    rockfish: { mouth: { x: 335, y: 165 } },
    manta: { mouth: { x: 735, y: 205 } }
};

/** The face of a look: its own (`face` in a profile's state) or its picture's. */
export const faceOf = st => st.face ?? FACES[st.key] ?? null;
