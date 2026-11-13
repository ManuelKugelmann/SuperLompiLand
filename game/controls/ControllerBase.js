import Phaser from 'phaser';

/**
 * Base for a swappable control scheme. Each scheme owns its input listeners and
 * overlay graphics and removes them all in destroy(), so schemes can be switched
 * at runtime without leaking handlers.
 *
 *   this.ui     screen-space layer (does not scroll with the camera)
 *   this.world  world-space layer (markers that live in the level)
 */
export default class ControllerBase {
    constructor(scene, fish) {
        this.scene = scene;
        this.fish = fish;
        this.ui = scene.add.container(0, 0).setDepth(40).setScrollFactor(0);
        this.world = scene.add.container(0, 0).setDepth(6);
        this._listeners = [];
    }

    listen(target, event, fn) {
        target.on(event, fn, this);
        this._listeners.push([target, event, fn]);
        // A press that is let go outside the game picture (beside it on a wide window, over
        // the browser frame) arrives as a different event. Without it a scheme would never
        // learn that the finger is up and would keep steering.
        if (event === 'pointerup') this.listen(target, 'pointerupoutside', fn);
        return this;
    }

    /** Pointer is on a HUD element (menu, buttons) — schemes ignore it. */
    overHud(pointer) {
        return !!this.scene.isOverHud?.(pointer);
    }

    /** Pointer position in world space (camera scroll applied). */
    worldPoint(pointer) {
        const p = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        return new Phaser.Math.Vector2(p.x, p.y);
    }

    hint(text) {
        const t = this.scene.add.text(this.scene.scale.width / 2, this.scene.scale.height - 60, text, {
            fontFamily: 'Arial', fontSize: '28px', color: '#ffffff'
        }).setOrigin(0.5).setAlpha(0.5);
        this.ui.add(t);
        this.scene.tweens.add({ targets: t, alpha: 0, delay: 5000, duration: 800 });
        return t;
    }

    enter() {}
    /** Per physics step (fixed 60 Hz): apply forces. */
    update(/* dt */) {}
    /** Per rendered frame: move overlay graphics (optional). */
    draw() {}

    destroy() {
        for (const [t, e, f] of this._listeners) t.off(e, f, this);
        this._listeners = [];
        this.ui.destroy();
        this.world.destroy();
    }
}
