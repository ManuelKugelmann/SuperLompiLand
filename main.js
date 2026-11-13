import IntroScene from './scenes/IntroScene.js';
import { SCENE_KEYS } from './scenes/keys.js';
import { bootStandalone } from '@gks/sdk/host/bootStandalone.js';

// Standalone entry. The shared host harness (SDK) builds the Phaser game —
// Matter physics + 1920x1080 FIT — and injects runtime registry values.
bootStandalone({
    IntroScene,
    introKey: SCENE_KEYS.INTRO,
    language: 'de'
});
