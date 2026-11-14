import Phaser from 'phaser';
import ControllerBase from './ControllerBase.js';
import SteerAssist from './SteerAssist.js';
import { TILT, gravityFromAngles, gravityFromMotion, screenAxes, tiltDir } from './tilt.js';
import { play } from '../audio.js';

const KICK = 9;            // speed added per tap
const STEER = 2.2;         // how strongly tilting bends the swimming direction
const LONG_PRESS_MS = 380;
const SENSOR_WAIT_MS = 1500;

/**
 * Tilt steering. Hold the phone like a tray: tilting it picks the direction
 * (relative to how it was held when the mode was switched on), tapping anywhere
 * gives speed — every tap is one stroke in the tilted direction, and tilting
 * alone bends the path of a gliding fish. Long press = puff.
 *
 * Getting sensor data on phones needs care:
 *  - iOS only hands it out after a permission prompt that is triggered from a
 *    real `click` / `touchend` (Phaser's pointerdown comes from touchstart and
 *    does not count), so the prompt is requested from DOM listeners.
 *  - Sensors only work on https (or localhost).
 *  - Some Android browsers deliver no `deviceorientation`; then gravity from
 *    `devicemotion` is used instead.
 * Without any sensor (desktop) the pointer position relative to the screen
 * centre stands in for the tilt.
 * `?debug=tilt` prints the raw values.
 */
export default class TiltController extends ControllerBase {
    enter() {
        const W = this.scene.scale.width, H = this.scene.scale.height;
        this.dir = new Phaser.Math.Vector2(0, 0);
        this.neutral = null;
        this.source = 'none';   // 'orientation' | 'motion' | 'pointer' | 'none'
        this.held = null;
        this.assist = new SteerAssist(this.scene, this.fish);
        this.debug = new URLSearchParams(window.location.search).get('debug') === 'tilt';
        this.raw = {};

        this.status = this.scene.add.text(W - 150, H - 250, '', {
            fontFamily: 'Arial', fontSize: '26px', color: '#ffffff', align: 'center', stroke: '#0a3f6e', strokeThickness: 5
        }).setOrigin(0.5, 1);
        this.ui.add(this.status);        // only says something when the sensor needs the player (or with ?debug=tilt)
        this.hint(this.de ? `Handy neigen = Richtung · tippen = Tempo · lange halten = ${this.specialWord()}`
            : `Tilt = direction · tap = speed · long press = ${this.specialWord()}`);

        this.onOrient = e => this.readOrientation(e);
        this.onMotion = e => this.readMotion(e);
        this.onGesture = () => this.askPermission();
        window.addEventListener('touchend', this.onGesture);
        window.addEventListener('click', this.onGesture);
        this.listenSensors();
        this.enteredAt = performance.now();

        this.listen(this.scene.input, 'pointerdown', this.onDown);
        this.listen(this.scene.input, 'pointermove', this.onMove);
        this.refreshStatus();
    }

    listenSensors() {
        window.addEventListener('deviceorientation', this.onOrient);
        window.addEventListener('devicemotion', this.onMotion);
    }

    /** Must run inside a click / touchend handler (see class comment). */
    askPermission() {
        if (this.asked) return;
        const types = [window.DeviceOrientationEvent, window.DeviceMotionEvent].filter(t => t && typeof t.requestPermission === 'function');
        if (!types.length) return;
        this.asked = true;
        Promise.all(types.map(t => t.requestPermission().catch(() => 'denied'))).then(states => {
            this.denied = !states.includes('granted');
            if (!this.denied) this.listenSensors();
            this.refreshStatus();
        });
    }

    needsPermission() {
        const D = window.DeviceOrientationEvent;
        return !!D && typeof D.requestPermission === 'function' && !this.asked;
    }

    /**
     * The direction gravity pulls in the device's axes (tilt.js) -> the steering direction in game
     * axes: toward the screen edge that is tilted down, measured from how the phone was held when
     * this source first reported (or the mode was switched on).
     */
    applyGravity(g, source) {
        // The page as the system has turned it, and our own quarter turn when a portrait screen shows the game sideways.
        const angle = (window.screen.orientation?.angle ?? window.orientation ?? 0), rotated = !!this.scene.registry.get('landscapeRotated');
        if (this.source !== source || this.angle !== angle || this.rotated !== rotated) {
            if (this.source !== source) { this.source = source; this.refreshStatus(); }
            this.angle = angle; this.rotated = rotated; this.neutral = null;      // turned round: level is how it is held now
        }
        if (!this.neutral) this.neutral = { ...g };
        tiltDir(g, this.neutral, screenAxes(angle, rotated), this.dir);
        this.raw = { g, angle, rotated };
    }

    readOrientation(e) {
        if (e.beta === null || e.gamma === null) return;
        this.applyGravity(gravityFromAngles(e.beta, e.gamma), 'orientation');
    }

    /** Fallback: gravity straight from the motion sensor when no orientation events arrive. */
    readMotion(e) {
        if (this.source === 'orientation') return;
        const a = e.accelerationIncludingGravity;
        if (!a || a.x === null || a.y === null || a.z === null) return;
        if (performance.now() - this.enteredAt < SENSOR_WAIT_MS) return; // give orientation a chance first
        this.applyGravity(gravityFromMotion(a.x, a.y, a.z, /iphone|ipad|ipod/i.test(navigator.userAgent)), 'motion');
    }

    /** The mouse standing in for the tilt (no sensor): x, y each -1..1 at full. */
    setDir(x, y) {
        this.dir.set(x, y);
        const len = this.dir.length();
        if (len < TILT.dead) this.dir.set(0, 0);
        else this.dir.setLength(Math.min(1, (len - TILT.dead) / (1 - TILT.dead)));
    }

    onMove(pointer) {
        if (this.source === 'orientation' || this.source === 'motion') return;
        // No sensor: only a mouse (hover) can stand in; a finger would fight the taps.
        if (pointer.wasTouch) return;
        const W = this.scene.scale.width, H = this.scene.scale.height;
        if (this.source !== 'pointer') { this.source = 'pointer'; this.refreshStatus(); }
        this.setDir((pointer.x - W / 2) / (H * 0.4), (pointer.y - H / 2) / (H * 0.4));
    }

    onDown(pointer) {
        if (this.overHud(pointer)) return;
        this.held = pointer;
        this.heldSince = this.scene.time.now;
        // No tilt: stroke straight ahead.
        const d = this.dir.lengthSq() > 0 ? this.dir.clone() : new Phaser.Math.Vector2(this.fish.facing, 0);
        // A stroke against a step goes up along it (the shared wall slide).
        const a = this.assist.aim(d.normalize());
        this.fish.launch(d.set(a.x, a.y).setLength(KICK));
        play('flap');
    }

    refreshStatus() {
        const de = this.de;
        let text = '';
        if (this.source === 'orientation' || this.source === 'motion') text = '';
        else if (!window.isSecureContext) text = de ? 'Neigen braucht https' : 'Tilt needs https';
        else if (this.denied) text = de ? 'Bewegungssensor\nnicht erlaubt' : 'Motion sensor\nnot allowed';
        else if (this.needsPermission()) text = de ? 'Tippen, um Neigen\nzu aktivieren' : 'Tap to enable\ntilt';
        else if (this.source === 'pointer') text = de ? 'kein Sensor:\nMaus steuert' : 'no sensor:\nmouse steers';
        else text = de ? 'warte auf Sensor …' : 'waiting for sensor …';
        this.status.setText(text);
    }

    update() {
        if (this.dir.lengthSq() > 0) this.fish.airSteer(this.dir, STEER);
        if (!this.held) return;
        if (!this.held.isDown) { this.held = null; return; }
        if (this.scene.time.now - this.heldSince > LONG_PRESS_MS) {
            this.fish.special();
            this.held = null;
        }
    }

    draw() {
        this.drawDemo();
        if (this.debug) {
            const r = this.raw, f = v => (typeof v === 'number' ? v.toFixed(1) : String(v));
            this.status.setText(`src ${this.source}\ng ${f(r.g?.x)} ${f(r.g?.y)} ${f(r.g?.z)}\nangle ${f(r.angle)} rot ${r.rotated}\ndir ${f(this.dir.x)} ${f(this.dir.y)}`);
        } else if (this.source === 'none' && performance.now() - this.enteredAt > SENSOR_WAIT_MS * 2 && !this.waited) {
            this.waited = true;
            this.refreshStatus();
        }
    }

    destroy() {
        window.removeEventListener('deviceorientation', this.onOrient);
        window.removeEventListener('devicemotion', this.onMotion);
        window.removeEventListener('touchend', this.onGesture);
        window.removeEventListener('click', this.onGesture);
        super.destroy();
    }
}
