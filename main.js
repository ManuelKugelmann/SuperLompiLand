import IntroScene from './scenes/IntroScene.js';
import { SCENE_KEYS } from './scenes/keys.js';
import { bootStandalone } from '@gks/sdk/host/bootStandalone.js';
import { forceLandscape } from './game/orientation.js';

// Standalone entry. The shared host harness (SDK) builds the Phaser game —
// Matter physics + 1920x1080 FIT — and injects runtime registry values.
const game = bootStandalone({
    IntroScene,
    introKey: SCENE_KEYS.INTRO,
    language: 'de'
});

// Always display landscape — rotate 90° when the viewport is portrait, even if
// the device is OS-locked to portrait. Keeps FIT scaling and input correct.
forceLandscape(game);

if (import.meta.env.DEV) window.__game = game; // console/debug handle, dev only
