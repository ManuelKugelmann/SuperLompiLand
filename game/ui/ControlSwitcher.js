import { CONTROL_SCHEMES } from '../controls/index.js';
import { pillButton } from './kit.js';

/**
 * Top-center row of pills to switch control schemes live, plus a small
 * physics-debug toggle. Lives in the HUD scene, so it never scrolls.
 */
export default class ControlSwitcher {
    constructor(scene, activeId, onSelect, onToggleDebug) {
        const W = scene.scale.width;
        const bw = 226, bh = 76, gap = 14, y = 62;
        const total = CONTROL_SCHEMES.length * bw + (CONTROL_SCHEMES.length - 1) * gap;
        let x = (W - total) / 2 + bw / 2;
        this.buttons = {};
        for (const s of CONTROL_SCHEMES) {
            this.buttons[s.id] = pillButton(scene, x, y, bw, bh, s.label, () => onSelect(s.id));
            x += bw + gap;
        }
        this.debug = pillButton(scene, W - 105, y, 150, 60, 'Debug', onToggleDebug, { size: 22 });
        this.setActive(activeId);
    }

    setActive(id) {
        for (const [sid, b] of Object.entries(this.buttons)) b.setSelected(sid === id);
    }

    setDebug(on) {
        this.debug.setSelected(on);
    }
}
