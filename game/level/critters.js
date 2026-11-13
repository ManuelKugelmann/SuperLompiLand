// Animated sea creatures from single images.
//
// Each creature is a strip mesh (Phaser Rope) or plain image that is deformed a
// little every frame, so nothing in the water is a stiff cut-out:
//   swim   fish-like: the tail end waves (art faces right; `tail: 'right'` for art facing left)
//   pulse  jellyfish: the bell pumps, the tentacles trail and sway
//   sway   seahorse: the whole body curls gently from the head down
//   wobble sitters (starfish, snail, slug): tiny rocking and breathing
//   throb  urchin: spines swell in and out
//   still  no deformation (spike plates)
// Plants use `sway` with `root: 'bottom'` (fixed at the base, free at the tip).

import { musicClock, nowSeconds } from '../audio.js';

const SEGMENTS = 10;

/**
 * @returns a game object with x/y/scale/rotation plus `animate(t)` (t in seconds)
 *          and `face(dir)` (1 = as drawn, -1 = mirrored).
 */
export function makeCritter(scene, key, x, y, width, anim = 'wobble', opts = {}) {
    const vertical = anim === 'pulse' || anim === 'sway';
    const mesh = anim === 'swim' || vertical;
    const obj = mesh
        ? scene.add.rope(x, y, key, null, SEGMENTS, !vertical)
        : scene.add.image(x, y, key);
    const base = width / obj.frame.width;
    const baseY = opts.scaleY ?? base;   // plants set their own height
    const phase = (Math.abs(x) * 0.013 + Math.abs(y) * 0.007) % 6.28; // desync neighbours
    const speed = opts.speed ?? 1;
    let dir = 1;
    obj.setScale(base, baseY);
    obj.face = d => { dir = d < 0 ? -1 : 1; };
    obj.facing = () => dir;

    obj.animate = (t, bend = 0) => {
        const p = t * speed + phase;
        let sx = base, sy = baseY;
        if (anim === 'swim') {
            const amp = obj.frame.height * 0.07;
            const pts = obj.points, n = pts.length - 1;
            for (let i = 0; i <= n; i++) {
                const tail = opts.tail === 'right' ? i / n : 1 - i / n;
                pts[i].y = Math.sin(p * 5 - tail * 2.4) * amp * tail * tail;
            }
            obj.setDirty();
        } else if (anim === 'pulse') {
            // The bell contracts on the music's beat and relaxes until the next one
            // (Nintendo style: every jelly in view pumps together, spec ch.12).
            const beat = musicClock.pulse(nowSeconds(), 3.5) * 2 - 1;
            sx = base * (1 - beat * 0.06);
            sy = base * (1 + beat * 0.08);
            const amp = obj.frame.width * 0.06;
            const pts = obj.points, n = pts.length - 1;
            for (let i = 0; i <= n; i++) {
                const f = i / n; // 0 = top of the bell, 1 = tentacle tips
                pts[i].x = Math.sin(p * 2.6 - f * 3.2) * amp * f * f;
            }
            obj.setDirty();
        } else if (anim === 'sway') {
            const amp = obj.frame.width * 0.05;
            const pts = obj.points, n = pts.length - 1;
            for (let i = 0; i <= n; i++) {
                const f = opts.root === 'bottom' ? 1 - i / n : i / n;
                pts[i].x = Math.sin(p * 2.2 - f * 2) * amp * f * (opts.root === 'bottom' ? 2.4 : 1)
                    + bend * obj.frame.width * 0.9 * f * f;   // pushed aside by a passing fish
            }
            obj.setDirty();
        } else if (anim === 'throb') {
            const beat = Math.sin(p * 3);
            sx = sy = base * (1 + beat * 0.045);
        } else if (anim === 'still') {
            obj.rotation = opts.rotation ?? 0;
        } else {
            obj.rotation = (opts.rotation ?? 0) + Math.sin(p * 1.6) * 0.05;
            sy = base * (1 + Math.sin(p * 2.3) * 0.025);
        }
        obj.setScale(sx * dir, sy);
    };
    return obj;
}
