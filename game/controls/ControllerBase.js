import Phaser from 'phaser';

/**
 * Base for a swappable control scheme. Each scheme owns its own input listeners
 * and overlay UI, and tears them all down on destroy() so switching schemes at
 * runtime never leaks handlers. Subclasses implement enter()/update()/leave().
 */
export default class ControllerBase {
    constructor(scene, fish) {
        this.scene = scene;
        this.fish = fish;
        this.ui = scene.add.container(0, 0).setDepth(40);
        this._listeners = [];
    }

    /** Register a listener and remember it for teardown. */
    listen(target, event, fn) {
        target.on(event, fn, this);
        this._listeners.push([target, event, fn]);
        return this;
    }

    /** True if a pointerdown landed on a HUD element (tagged data 'hud'). */
    overHud(currentlyOver) {
        return currentlyOver && currentlyOver.some(o => o.getData && o.getData('hud'));
    }

    enter() {}
    update(/* dt */) {}

    destroy() {
        for (const [t, e, f] of this._listeners) t.off(e, f, this);
        this._listeners = [];
        this.ui.destroy();
    }
}
