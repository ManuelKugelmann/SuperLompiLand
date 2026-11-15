import { CONTROL_SCHEMES } from '../controls/index.js';
import { pillButton } from './kit.js';
import { MENU } from './GameMenu.js';

export const SWITCHER = {
    icon: 84,            // px across of one scheme's icon
    gap: 18,             // px between two icons
    margin: [40, 190],   // px from the right edge of the picture to the row, and the row's height from the top (under the quick icons)
    ring: 0xffd54a,      // the ring round the scheme in use
    idle: 0.7            // how solid the other icons are
};

/** Painted icons, one per control scheme (loaded by the title screen); a small word pill is shown for a scheme whose icon is missing. */
export const CONTROL_ART = Object.fromEntries(CONTROL_SCHEMES.map(s => [`ctrl_${s.id}`, `img/ui/ctrl_${s.id}.webp`]));

/**
 * A small row of icons in the top right corner to switch control schemes live, plus a
 * physics-debug toggle (only with ?debug). Lives in the HUD scene, so it never scrolls. The row
 * is hidden most of the time, so the picture stays free (HudScene decides when it shows).
 */
export default class ControlSwitcher {
    constructor(scene, activeId, onSelect, onToggleDebug) {
        const W = scene.scale.width, S = SWITCHER, n = CONTROL_SCHEMES.length, y = S.margin[1] + MENU.corner;      // in from the corner with the top line
        const lang = scene.registry.get('currentLanguage') === 'en' ? 'en' : 'de';
        this.buttons = {};
        CONTROL_SCHEMES.forEach((s, i) => {
            const x = W - S.margin[0] - MENU.corner - S.icon / 2 - (n - 1 - i) * (S.icon + S.gap), key = `ctrl_${s.id}`;
            if (!scene.textures.exists(key)) {      // no icon: the scheme's name in a small pill
                this.buttons[s.id] = pillButton(scene, x, y, S.icon + S.gap - 6, S.icon * 0.7, s.label[lang], () => onSelect(s.id), { size: 20 });
                return;
            }
            const ring = scene.add.circle(x, y, S.icon * 0.56).setStrokeStyle(5, S.ring, 1).setVisible(false);
            const img = scene.add.image(x, y, key).setDisplaySize(S.icon, S.icon).setInteractive({ useHandCursor: true });
            img.on('pointerdown', () => onSelect(s.id));
            let selected = false, shown = true;
            this.buttons[s.id] = {
                setSelected(on) { selected = !!on; img.setAlpha(selected ? 1 : S.idle); ring.setVisible(shown && selected); },
                setVisible(on) {
                    shown = !!on;
                    img.setVisible(shown); ring.setVisible(shown && selected);
                    if (shown) img.setInteractive({ useHandCursor: true }); else img.disableInteractive();
                }
            };
        });
        // The physics-debug toggle is a developer's tool: only with ?debug in the address.
        this.debug = new URLSearchParams(window.location.search).has('debug')
            ? pillButton(scene, W - S.margin[0] - 75, y + S.icon, 150, 60, 'Debug', onToggleDebug, { size: 22 }) : null;
        this.setActive(activeId);
    }

    /** Show or hide the row: it is only there when it is needed (first run, or called from the menu). */
    setVisible(on) {
        for (const b of Object.values(this.buttons)) b.setVisible(on);
    }

    setActive(id) {
        for (const [sid, b] of Object.entries(this.buttons)) b.setSelected(sid === id);
    }

    setDebug(on) {
        this.debug?.setSelected(on);
    }
}
