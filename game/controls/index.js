import VirtualStickController from './VirtualStickController.js';
import TapToMoveController from './TapToMoveController.js';
import SlingshotController from './SlingshotController.js';

/**
 * Registry of switchable control schemes — the "switchable options for
 * experimentation" from the brief. Add a scheme here and it shows up in the
 * in-game switcher automatically.
 */
export const CONTROL_SCHEMES = [
    { id: 'stick', label: 'Stick', Ctor: VirtualStickController },
    { id: 'tap', label: 'Tap-to-Move', Ctor: TapToMoveController },
    { id: 'sling', label: 'Schleuder', Ctor: SlingshotController }
];

export function makeController(id, scene, fish) {
    const entry = CONTROL_SCHEMES.find(s => s.id === id) || CONTROL_SCHEMES[0];
    const c = new entry.Ctor(scene, fish);
    c.enter();
    return c;
}
