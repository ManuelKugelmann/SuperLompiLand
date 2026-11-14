import Phaser from 'phaser';
import { SPECIALS } from '../specials.js';
import GhostFinger from '../ui/GhostFinger.js';

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
        this.de = (scene.registry.get('currentLanguage') || 'de') === 'de';
    }

    /** What this character's special move is called (for the hints). */
    specialWord() {
        return SPECIALS[this.fish.char.special].label[this.de ? 'de' : 'en'];
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

    /**
     * How to play: on the first starts of a scheme a ghost finger shows it without words (spec 9.1),
     * gone at the first touch; later the line of text below.
     */
    hint(text) {
        this.demo = GhostFinger.maybe(this.scene, this.ui, this.schemeId);
        if (this.demo) { this.listen(this.scene.input, 'pointerdown', () => this.demo.stop()); return null; }
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
    draw() { this.drawDemo(); }

    /** Moves the ghost finger along with the fish (schemes that override draw() call this). */
    drawDemo() {
        if (!this.demo || this.demo.done) return;
        const [x, y] = this.demoAnchor();
        this.demo.update(this.scene.game.loop.delta / 1000, x, y);
    }

    /** Where on screen the ghost finger's script is anchored: the fish (a scheme may say otherwise). */
    demoAnchor() {
        const view = this.scene.cameras.main.worldView, sp = this.fish.sprite;
        return [sp.x - view.x, sp.y - view.y];
    }

    destroy() {
        for (const [t, e, f] of this._listeners) t.off(e, f, this);
        this._listeners = [];
        this.ui.destroy();
        this.world.destroy();
    }
}
