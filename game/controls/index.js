import VirtualStickController from './VirtualStickController.js';
import TapToMoveController from './TapToMoveController.js';
import FlapController from './FlapController.js';
import TiltController from './TiltController.js';

/**
 * Registry of switchable control schemes. Add one here and it appears in the
 * in-game switcher automatically.
 */
export const CONTROL_SCHEMES = [
    { id: 'tap', label: { de: 'Tippen', en: 'Tap' }, Ctor: TapToMoveController },     // first = default for new players
    { id: 'flap', label: { de: 'Flattern', en: 'Flap' }, Ctor: FlapController },
    { id: 'tilt', label: { de: 'Neigen', en: 'Tilt' }, Ctor: TiltController },
    { id: 'stick', label: { de: 'Stick', en: 'Stick' }, Ctor: VirtualStickController }
];

export function makeController(id, scene, fish) {
    const entry = CONTROL_SCHEMES.find(s => s.id === id) || CONTROL_SCHEMES[0];
    const c = new entry.Ctor(scene, fish);
    c.schemeId = entry.id;      // which ghost-finger script teaches it
    c.enter();
    return c;
}
