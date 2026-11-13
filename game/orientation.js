import Phaser from 'phaser';

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
    const GW = scale.width;   // logical game width (1920)
    const GH = scale.height;  // logical game height (1080)

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
        const rect = canvas.getBoundingClientRect(); // rotated → axis-aligned bbox
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const s = rect.height / GW; // displayed (pre-rotation) canvas width = rect.height
        const gx = (pageY - cy) / s + GW / 2;
        const gy = -(pageX - cx) / s + GH / 2;
        pointer.x = gx;
        pointer.y = gy;
        pointer.position.set(gx, gy);
    };

    // (3) Size + rotate the container, then refresh Phaser.
    function layout() {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        rotated = vh > vw && handheld;

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
