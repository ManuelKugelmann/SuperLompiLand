// One look for all in-game UI: soft rounded "pill" surfaces with a drop shadow
// and a light top edge, a warm accent for the selected state, bold white text
// with a dark outline. Everything the HUD draws goes through these helpers.

export const UI = {
    surface: 0x0b5566,       // normal button / panel
    surfaceDark: 0x063a47,
    accent: 0xffc266,        // selected
    accentText: '#06343a',
    text: '#ffffff',
    outline: '#0a3f6e',
    shadow: 0x02212b,
    font: 'Arial, sans-serif',
    radius: 26
};

export function textStyle(size, color = UI.text, outline = true) {
    return {
        fontFamily: UI.font, fontSize: `${size}px`, color, fontStyle: 'bold',
        ...(outline ? { stroke: UI.outline, strokeThickness: Math.max(4, Math.round(size / 6)) } : {})
    };
}

/** Modern HUD text (2026-11-15 "HUD modernization"): no heavy outline, a soft shadow keeps it readable on any water. */
export function softText(size, color = UI.text) {
    return { fontFamily: UI.font, fontSize: `${size}px`, color, fontStyle: 'bold', shadow: { offsetX: 0, offsetY: 2, color: '#021a26', blur: 8, fill: true } };
}

/** Draw a pill surface into a Graphics object (cleared first). */
export function drawPill(g, w, h, { fill = UI.surface, alpha = 0.92, radius = UI.radius, ox = 0, oy = 0 } = {}) {
    const r = Math.min(radius, h / 2), x = ox - w / 2, y = oy - h / 2;
    g.clear();
    g.fillStyle(UI.shadow, 0.35).fillRoundedRect(x + 2, y + 6, w, h, r);         // shadow
    g.fillStyle(fill, alpha).fillRoundedRect(x, y, w, h, r);                      // body
    g.fillStyle(0xffffff, 0.16).fillRoundedRect(x + 6, y + 5, w - 12, h * 0.36, r * 0.7); // top light
    g.lineStyle(3, 0xffffff, 0.45).strokeRoundedRect(x, y, w, h, r);
}

/**
 * A pill baked once into a texture (cached by size and look) and shown as an Image centred on the
 * pill's body. Rounded paths in a live Graphics are re-triangulated every frame (measured: the menu
 * button alone cost more than a shoal on a throttled phone); a baked picture costs one quad.
 * `extra(g, cx, cy)` may draw more on top before baking; name it in `id` so it gets its own texture.
 * Returns { key, originX, originY }.
 */
export function pillTexture(scene, w, h, opts = {}, extra = null, id = '') {
    const { fill = UI.surface, alpha = 0.92, radius = UI.radius } = opts;
    w = Math.round(w); h = Math.round(h);
    const key = `pill:${w}x${h}:${fill}:${alpha}:${radius}:${id}`, cx = w / 2 + 1, cy = h / 2 + 1;
    if (!scene.textures.exists(key)) {
        const g = scene.make.graphics({}, false);
        drawPill(g, w, h, { fill, alpha, radius, ox: cx, oy: cy });
        extra?.(g, cx, cy);
        g.generateTexture(key, w + 5, h + 9);
        g.destroy();
    }
    return { key, originX: cx / (w + 5), originY: cy / (h + 9) };
}

/** A baked pill (pillTexture) as an Image centred at (x, y). */
export function pillImage(scene, x, y, w, h, opts = {}, extra = null, id = '') {
    const t = pillTexture(scene, w, h, opts, extra, id);
    return scene.add.image(x, y, t.key).setOrigin(t.originX, t.originY);
}

/**
 * A tappable pill button. Returns { setSelected(on), setLabel(text), destroy() }.
 * The hit area is an invisible rectangle, so the whole pill is easy to hit.
 */
export function pillButton(scene, x, y, w, h, label, onTap, { size = 30 } = {}) {
    const img = scene.add.image(x, y, '__DEFAULT');
    const txt = scene.add.text(x, y, label, textStyle(size, UI.text, false)).setOrigin(0.5);
    const hit = scene.add.rectangle(x, y, w, h, 0xffffff, 0).setInteractive({ useHandCursor: true });
    let selected = false;
    const paint = pressed => {
        const p = pillTexture(scene, w, h, { fill: selected ? UI.accent : (pressed ? UI.surfaceDark : UI.surface), alpha: selected ? 1 : 0.9 });
        img.setTexture(p.key).setOrigin(p.originX, p.originY);
        txt.setColor(selected ? UI.accentText : UI.text);
    };
    hit.on('pointerdown', () => { paint(true); onTap(); });
    hit.on('pointerup', () => paint(false));
    hit.on('pointerout', () => paint(false));
    paint(false);
    return {
        setSelected(on) { selected = !!on; paint(false); },
        setLabel(text) { txt.setText(text); },
        setVisible(on) { img.setVisible(on); txt.setVisible(on); hit.setVisible(on); if (on) hit.setInteractive({ useHandCursor: true }); else hit.disableInteractive(); },
        destroy() { img.destroy(); txt.destroy(); hit.destroy(); }
    };
}

/** The painted heart pictures (scripts/fx/hearts.py), loaded with the art. */
export const HEART_ART = ['heart_full', 'heart_half', 'heart_empty'];
export const HEART_FILES = Object.fromEntries(HEART_ART.map(k => [k, `img/ui/${k}.png`]));

function paintedHearts(scene, x, y, max, size) {
    const step = size * 1.08, hearts = [];
    for (let i = 0; i < max; i++) {
        const cx = x + i * step + size / 2;
        const back = scene.add.image(cx, y, 'heart_empty').setDisplaySize(size, size);
        const front = scene.add.image(cx, y, 'heart_full').setDisplaySize(size, size);
        hearts.push({ back, front });
    }
    let shown = max;
    return {
        set(value) {
            hearts.forEach((h, i) => {
                const fill = Math.max(0, Math.min(1, value - i));         // supports half hearts
                h.front.setVisible(fill > 0).setTexture(fill >= 1 ? 'heart_full' : 'heart_half').setDisplaySize(size, size);
                h.back.setVisible(fill < 1);      // a full heart covers its glass one: one picture per heart (fewer draws on slow phones)
            });
            const changed = hearts[Math.max(0, Math.min(hearts.length - 1, Math.ceil(value < shown ? value : value - 1)))];
            if (changed && value !== shown) {
                const s = changed.front.scaleX;
                scene.tweens.add({ targets: [changed.back, changed.front], scaleX: s * 1.35, scaleY: s * 1.35, duration: 140, yoyo: true });
            }
            shown = value;
        }
    };
}

/** A row of hearts as the health display. Returns { set(value, max) }. */
export function heartRow(scene, x, y, max, size = 46) {
    // The painted hearts (tester: the pink flat text hearts with a white line looked old-school):
    // a glass heart behind, a glossy full or half heart in front. Text hearts only if the art is missing.
    if (HEART_ART.every(k => scene.textures.exists(k))) return paintedHearts(scene, x, y, max, size);
    const hearts = [];
    for (let i = 0; i < max; i++) {
        const back = scene.add.text(x + i * (size + 6), y, '♥', { fontFamily: UI.font, fontSize: `${size}px`, color: '#06343a' })
            .setOrigin(0, 0.5).setAlpha(0.55).setStroke('#ffffff', 5);
        const front = scene.add.text(x + i * (size + 6), y, '♥', { fontFamily: UI.font, fontSize: `${size}px`, color: '#ff5a86' })
            .setOrigin(0, 0.5).setStroke('#ffffff', 5);
        hearts.push({ back, front });
    }
    let shown = max;
    return {
        set(value) {
            hearts.forEach((h, i) => {
                const fill = Math.max(0, Math.min(1, value - i)); // supports half hearts
                h.front.setAlpha(fill);
            });
            if (value < shown) {
                const lost = hearts[Math.max(0, Math.ceil(value))];
                if (lost) scene.tweens.add({ targets: [lost.back, lost.front], scale: 1.5, duration: 140, yoyo: true });
            }
            shown = value;
        }
    };
}
