import IntroScene from './scenes/IntroScene.js';
import { SCENE_KEYS } from './scenes/keys.js';
import { bootStandalone } from '@gks/sdk/host/bootStandalone.js';
import { forceLandscape } from './game/orientation.js';

// Standalone entry. The shared host harness (SDK) builds the Phaser game —
// Matter physics + 1920x1080 FIT — and injects runtime registry values.
const game = bootStandalone({
    IntroScene,
    introKey: SCENE_KEYS.INTRO,
    language: 'de',
    config: {
        // Listen on the whole window, not just the canvas: on desktop the mouse
        // keeps steering when it is dragged outside the game area.
        input: { mouse: { target: window }, touch: { target: window } },
        // No multisampling on the canvas (research-performance.md: a cheap win on Mali/Adreno low-end); pictures stay smooth
        // because their edges are filtered in the textures, not by MSAA.
        render: { antialiasGL: false, powerPreference: 'high-performance' }
    }
});

// Always display landscape — rotate 90° when the viewport is portrait, even if
// the device is OS-locked to portrait. The picture always covers the whole screen.
forceLandscape(game);

// Console/debug handle: in development, and for the push gate's smoke check of the build (scripts/smoke.mjs, `?smoke`).
if (import.meta.env.DEV || new URLSearchParams(location.search).has('smoke')) window.__game = game;
