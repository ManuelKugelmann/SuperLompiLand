import { makeSceneKeys } from '@gks/sdk/host/sceneKeys.js';

// This game's scene keys, derived from one unique NAME prefix. INTRO is the
// PUBLIC sceneKey (matches gameMeta.sceneKey); MAIN/END are internal. Keys must
// be globally unique when this game is registered alongside others in one host.
export const SCENE_KEYS = makeSceneKeys('SuperLompi');
