// A sand skirt at the foot of a prop standing on the floor (user: "all asset bases should smoothly
// integrate with terrain"): a low, soft mound of sand and grit drawn just in front of the prop's base,
// so a boulder, coral or crate sits in the seabed instead of on a hard picture edge. Procedural
// (one shared texture, tinted per biome: its sand colour, or silt where the floor has none).
import { SAND_SKIN } from './shade.js';

export const PROP_SKIRT = {
    key: 'prop_skirt',
    width: 0.95,       // of the prop's width
    height: 0.16,      // of the skirt's width: a low mound (the prop itself settles into dips: LEVEL.propSettle)
    sink: 0.4,         // share of its height that lies below the prop's foot point: it straddles the ground line
    depth: 0.86,       // just in front of the terrain and its sand ripples (0.85), behind the ground cover (0.9): it covers
                       // the gap a prop behind the play plane can leave over a dip in the floor
    maxWidth: 600,     // px: bigger props (hulls, wrecks) sink into the floor by their own art; a skirt that wide read as a fog bank
    silt: 0xb9b2a2,    // tint where a biome has no sand skin (wreck, harbour, blue, trench)
    water: 0.1         // share of the biome's water tone mixed into it (the terrain's sand is graded by the water too)
};

/** The skirt picture (once): a flat mound, densest in the middle, with grains, soft on top and at the ends. */
export function ensureSkirt(scene) {
    if (scene.textures.exists(PROP_SKIRT.key)) return;
    const W = 256, H = 56, t = scene.textures.createCanvas(PROP_SKIRT.key, W, H), c = t.getContext();
    let seed = 17; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // The mound: soft, centred on its foot, fading upward and to its ends.
    const g = c.createRadialGradient(W / 2, H, 4, W / 2, H, W / 2);
    g.addColorStop(0, 'rgba(250,250,250,0.95)'); g.addColorStop(0.55, 'rgba(240,240,240,0.7)'); g.addColorStop(1, 'rgba(230,230,230,0)');
    c.save(); c.scale(1, H / (W / 2)); c.fillStyle = g; c.beginPath(); c.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2); c.fill(); c.restore();
    // Grains and a few pebbles, darker and lighter, mostly in the middle.
    for (let i = 0; i < 260; i++) {
        const u = (r() + r()) / 2, x = W * u, y = H * (0.45 + r() * 0.5), s = 0.6 + r() * 1.4;
        const keep = 1 - Math.abs(u - 0.5) * 1.6; if (keep <= 0) continue;
        c.fillStyle = r() < 0.5 ? `rgba(120,110,95,${0.35 * keep})` : `rgba(255,255,255,${0.5 * keep})`;
        c.fillRect(x, y, s, s);
    }
    t.refresh();
}

/** The skirt's tint for a biome. */
export const skirtTint = biomeId => SAND_SKIN[biomeId]?.[0] ?? PROP_SKIRT.silt;
