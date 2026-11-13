// Host entry point. A host imports this game via this file: it re-exports the
// IntroScene (default) and its gameMeta. Standalone dev uses main.js instead;
// both resolve to the same IntroScene.
export { default as default, gameMeta } from './scenes/IntroScene.js';
