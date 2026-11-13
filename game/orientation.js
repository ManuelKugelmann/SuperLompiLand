import Phaser from 'phaser';
import { rotatedPageToGame, widthFor } from './orientationMath.js';

/**
 * Always-landscape display.
 *
 * When a HANDHELD device's viewport is PORTRAIT — including a device that is
 * OS-locked to portrait, where orientation APIs can't help — the Phaser canvas
 * is rotated 90° to fill the screen in landscape. In landscape, and on desktop
 * (any window shape), the game stays upright.
 *
 * A plain CSS rotation would break two things that this fixes:
 *   1. Phaser's FIT scaling reads the parent's bounding box, which for a
 *      rotated element reports the portrait box — so we feed Phaser the correct
 *      landscape dimensions directly (getParentBounds override).
 *   2. Pointer input: Phaser maps page X/Y per-axis and can't express a 90°
 *      rotation, so taps land in the wrong place — we patch transformPointer to
 *      map screen coordinates back into game space.
 *
 * Call once with the booted Phaser.Game.
 */
export function forceLandscape(game) {
    if (game.isBooted) install(game);
    else game.events.once(Phaser.Core.Events.READY, () => install(game));
}

function install(game) {
    const scale = game.scale;
    const canvas = game.canvas;
    const app = canvas.parentElement || document.getElementById('app');

    let rotated = false;

    // Only handheld touch devices rotate. A desktop window that happens to be
    // taller than wide stays upright (letterboxed landscape).
    // `?rotate=1` / `?rotate=0` forces it either way for testing.
    const forced = new URLSearchParams(window.location.search).get('rotate');
    const handheld = forced !== null
        ? forced === '1'
        : window.matchMedia('(hover: none) and (pointer: coarse)').matches;

    // Phaser's own centering measures the (rotated) parent box, so turn it off
    // and let the container centre the canvas instead.
    scale.autoCenter = Phaser.Scale.NO_CENTER;
    canvas.style.marginLeft = '0';
    canvas.style.marginTop = '0';
    app.style.display = 'flex';
    app.style.alignItems = 'center';
    app.style.justifyContent = 'center';

    // (1) Give Phaser landscape parent dimensions no matter the CSS rotation.
    scale.getParentBounds = function () {
        const w = rotated ? window.innerHeight : window.innerWidth;
        const h = rotated ? window.innerWidth : window.innerHeight;
        if (this.parentSize.width !== w || this.parentSize.height !== h) {
            this.parentSize.setSize(w, h);
            return true;
        }
        return false;
    };

    // (2) Correct pointer coordinates while rotated.
    const manager = game.input; // Phaser.Input.InputManager
    const origTransform = manager.transformPointer.bind(manager);
    manager.transformPointer = function (pointer, pageX, pageY, wasMove) {
        origTransform(pointer, pageX, pageY, wasMove);
        if (!rotated) return;
        const p = rotatedPageToGame(pageX, pageY, canvas.getBoundingClientRect(), scale.width, scale.height);
        pointer.x = p.x;
        pointer.y = p.y;
        pointer.position.set(p.x, p.y);
    };

    // (3) Size + rotate the container, then refresh Phaser.
    function layout() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        rotated = vh > vw && handheld;
        game.registry.set('landscapeRotated', rotated); // tilt steering needs to know

        app.style.position = 'fixed';
        app.style.left = '50%';
        app.style.top = '50%';
        app.style.transformOrigin = 'center center';
        if (rotated) {
            app.style.width = vh + 'px';
            app.style.height = vw + 'px';
            app.style.transform = 'translate(-50%, -50%) rotate(90deg)';
        } else {
            app.style.width = vw + 'px';
            app.style.height = vh + 'px';
            app.style.transform = 'translate(-50%, -50%)';
        }
        scale.refresh();
    }

    layout();
    window.addEventListener('resize', layout);
    window.addEventListener('orientationchange', layout);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', layout);
}

/**
 * Fill the screen: give the game the width that matches the screen's shape (the
 * height stays fixed). Called when a scene starts, so a scene lays itself out
 * once for the size it will keep; returns true when the size changed.
 */
export function fitToWindow(game) {
    const rotated = !!game.registry.get('landscapeRotated');
    const w = widthFor(rotated ? window.innerHeight : window.innerWidth, rotated ? window.innerWidth : window.innerHeight);
    if (w === game.scale.width) return false;
    game.scale.setGameSize(w, game.scale.height);
    return true;
}

/** Would fitToWindow change the size right now? (for scenes that can simply start again) */
export function fitsWindow(game) {
    const rotated = !!game.registry.get('landscapeRotated');
    return widthFor(rotated ? window.innerHeight : window.innerWidth, rotated ? window.innerWidth : window.innerHeight) === game.scale.width;
}
