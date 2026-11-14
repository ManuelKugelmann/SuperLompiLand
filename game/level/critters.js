// Plants and drifting props from single images. (Animals are Creatures with a Rig: game/Creature.js.)
//
// Each one is a strip mesh (Phaser Rope) or a plain image, deformed a little every frame, so
// nothing in the water is a stiff cut-out:
//   sway   the strip curls gently from its fixed end; `root: 'bottom'` = fixed at the base (plants)
//   still  no deformation (scrap, drums)

const SEGMENTS = 10;

/**
 * @returns a game object with x/y/scale/rotation plus `animate(t, bend)` (t in seconds, bend =
 *          pushed aside by a passing fish) and `face(dir)` (1 = as drawn, -1 = mirrored).
 */
export function makeCritter(scene, key, x, y, width, anim = 'still', opts = {}) {
    const sways = anim === 'sway';
    const obj = sways ? scene.add.rope(x, y, key, null, SEGMENTS, false) : scene.add.image(x, y, key);
    const base = width / obj.frame.width;
    const baseY = opts.scaleY ?? base;   // plants set their own height
    const phase = (Math.abs(x) * 0.013 + Math.abs(y) * 0.007) % 6.28; // desync neighbours
    const speed = opts.speed ?? 1;
    let dir = 1;
    obj.setScale(base, baseY);
    obj.face = d => { dir = d < 0 ? -1 : 1; };
    if (!sways) obj.rotation = opts.rotation ?? 0;

    obj.animate = (t, bend = 0) => {
        if (sways) {
            const p = t * speed + phase;
            const amp = obj.frame.width * 0.05 * (opts.amp ?? 1);
            const pts = obj.points, n = pts.length - 1;
            for (let i = 0; i <= n; i++) {
                const f = opts.root === 'bottom' ? 1 - i / n : i / n;
                pts[i].x = Math.sin(p * 2.2 - f * 2) * amp * f * (opts.root === 'bottom' ? 2.4 : 1)
                    + bend * obj.frame.width * 0.9 * f * f;
            }
            obj.setDirty();
        }
        obj.setScale(base * dir, baseY);
    };
    return obj;
}
