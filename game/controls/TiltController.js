import Phaser from 'phaser';
import ControllerBase from './ControllerBase.js';

const KICK = 9;            // speed added per tap
const FULL_TILT = 22;      // degrees of tilt for full deflection
const DEAD_ZONE = 0.12;    // fraction of full tilt that is ignored
const STEER = 2.2;         // how strongly tilting bends the swimming direction
const LONG_PRESS_MS = 380;

/**
 * Tilt steering. Hold the phone like a tray: tilting it picks the direction
 * (relative to how it was held when the mode was switched on), tapping anywhere
 * gives speed — every tap is one stroke in the tilted direction, and tilting
 * alone bends the path of a gliding fish. Long press = puff.
 *
 * Without a motion sensor (desktop) the mouse position relative to the screen
 * centre stands in for the tilt, so the mode can be tried anywhere.
 */
export default class TiltController extends ControllerBase {
    enter() {
        const W = this.scene.scale.width, H = this.scene.scale.height;
        this.dir = new Phaser.Math.Vector2(0, 0);
        this.neutral = null;
        this.sensor = false;
        this.held = null;

        // Small compass in the corner shows the direction the tilt is giving.
        this.compass = this.scene.add.circle(W - 150, H - 150, 70, 0xffffff, 0.04).setStrokeStyle(2, 0xffffff, 0.16);
        this.needle = this.scene.add.circle(W - 150, H - 150, 14, 0xffffff, 0.3);
        this.ui.add([this.compass, this.needle]);
        this.hint('Handy neigen = Richtung · tippen = Tempo · lange halten = aufblasen');

        this.onOrient = e => this.readSensor(e);
        this.listenSensor();
        this.listen(this.scene.input, 'pointerdown', this.onDown);
        this.listen(this.scene.input, 'pointermove', this.onMove);
    }

    listenSensor() {
        window.addEventListener('deviceorientation', this.onOrient);
    }

    /** iOS only hands out motion data after a permission prompt from a tap. */
    askPermission() {
        const D = window.DeviceOrientationEvent;
        if (this.asked || !D || typeof D.requestPermission !== 'function') return;
        this.asked = true;
        D.requestPermission().then(state => { if (state === 'granted') this.listenSensor(); }).catch(() => {});
    }

    readSensor(e) {
        if (e.beta === null || e.gamma === null) return;
        this.sensor = true;
        // Tilt in screen axes: undo the OS screen rotation ...
        const angle = (window.screen.orientation?.angle ?? window.orientation ?? 0);
        let sx, sy;
        if (angle === 90) { sx = e.beta; sy = -e.gamma; }
        else if (angle === 270 || angle === -90) { sx = -e.beta; sy = e.gamma; }
        else if (angle === 180) { sx = -e.gamma; sy = -e.beta; }
        else { sx = e.gamma; sy = e.beta; }
        // ... and our own 90° turn when a portrait screen shows the game sideways.
        const rotated = !!this.scene.registry.get('landscapeRotated');
        const gx = rotated ? sy : sx;
        const gy = rotated ? -sx : sy;

        if (!this.neutral) this.neutral = { x: gx, y: gy }; // "level" = how it is held right now
        this.setDir((gx - this.neutral.x) / FULL_TILT, (gy - this.neutral.y) / FULL_TILT);
    }

    setDir(x, y) {
        this.dir.set(x, y);
        const len = this.dir.length();
        if (len < DEAD_ZONE) this.dir.set(0, 0);
        else this.dir.setLength(Math.min(1, (len - DEAD_ZONE) / (1 - DEAD_ZONE)));
    }

    onMove(pointer) {
        if (this.sensor) return;
        const W = this.scene.scale.width, H = this.scene.scale.height;
        this.setDir((pointer.x - W / 2) / (H * 0.4), (pointer.y - H / 2) / (H * 0.4));
    }

    onDown(pointer) {
        if (this.overHud(pointer)) return;
        this.askPermission();
        this.held = pointer;
        this.heldSince = this.scene.time.now;
        // No tilt: stroke straight ahead.
        const d = this.dir.lengthSq() > 0 ? this.dir.clone() : new Phaser.Math.Vector2(this.fish.facing, 0);
        this.fish.launch(d.setLength(KICK));
    }

    update() {
        if (this.dir.lengthSq() > 0) this.fish.airSteer(this.dir, STEER);
        if (!this.held) return;
        if (!this.held.isDown) { this.held = null; return; }
        if (this.scene.time.now - this.heldSince > LONG_PRESS_MS) {
            this.fish.puff();
            this.held = null;
        }
    }

    draw() {
        this.needle.setPosition(this.compass.x + this.dir.x * 56, this.compass.y + this.dir.y * 56);
    }

    destroy() {
        window.removeEventListener('deviceorientation', this.onOrient);
        super.destroy();
    }
}
