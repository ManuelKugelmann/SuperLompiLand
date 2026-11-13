import VirtualStickController from './VirtualStickController.js';
import TapToMoveController from './TapToMoveController.js';
import FlingController from './FlingController.js';
import FlapController from './FlapController.js';
import TiltController from './TiltController.js';

/**
 * Registry of switchable control schemes. Add one here and it appears in the
 * in-game switcher automatically.
 */
export const CONTROL_SCHEMES = [
    { id: 'tap', label: 'Tippen', Ctor: TapToMoveController },     // first = default for new players
    { id: 'fling', label: 'Schubsen', Ctor: FlingController },
    { id: 'flap', label: 'Flattern', Ctor: FlapController },
    { id: 'tilt', label: 'Neigen', Ctor: TiltController },
    { id: 'stick', label: 'Stick', Ctor: VirtualStickController }
];

export function makeController(id, scene, fish) {
    const entry = CONTROL_SCHEMES.find(s => s.id === id) || CONTROL_SCHEMES[0];
    const c = new entry.Ctor(scene, fish);
    c.enter();
    return c;
}
