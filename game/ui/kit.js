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

/** Draw a pill surface into a Graphics object (cleared first). */
export function drawPill(g, w, h, { fill = UI.surface, alpha = 0.92, radius = UI.radius } = {}) {
    const r = Math.min(radius, h / 2);
    g.clear();
    g.fillStyle(UI.shadow, 0.35).fillRoundedRect(-w / 2 + 2, -h / 2 + 6, w, h, r);         // shadow
    g.fillStyle(fill, alpha).fillRoundedRect(-w / 2, -h / 2, w, h, r);                      // body
    g.fillStyle(0xffffff, 0.16).fillRoundedRect(-w / 2 + 6, -h / 2 + 5, w - 12, h * 0.36, r * 0.7); // top light
    g.lineStyle(3, 0xffffff, 0.45).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
}

/**
 * A tappable pill button. Returns { setSelected(on), setLabel(text), destroy() }.
 * The hit area is an invisible rectangle, so the whole pill is easy to hit.
 */
export function pillButton(scene, x, y, w, h, label, onTap, { size = 30 } = {}) {
    const g = scene.add.graphics().setPosition(x, y);
    const txt = scene.add.text(x, y, label, textStyle(size, UI.text, false)).setOrigin(0.5);
    const hit = scene.add.rectangle(x, y, w, h, 0xffffff, 0).setInteractive({ useHandCursor: true });
    let selected = false;
    const paint = pressed => {
        drawPill(g, w, h, { fill: selected ? UI.accent : (pressed ? UI.surfaceDark : UI.surface), alpha: selected ? 1 : 0.9 });
        txt.setColor(selected ? UI.accentText : UI.text);
    };
    hit.on('pointerdown', () => { paint(true); onTap(); });
    hit.on('pointerup', () => paint(false));
    hit.on('pointerout', () => paint(false));
    paint(false);
    return {
        setSelected(on) { selected = !!on; paint(false); },
        setLabel(text) { txt.setText(text); },
        setVisible(on) { g.setVisible(on); txt.setVisible(on); hit.setVisible(on); if (on) hit.setInteractive({ useHandCursor: true }); else hit.disableInteractive(); },
        destroy() { g.destroy(); txt.destroy(); hit.destroy(); }
    };
}

/** A row of hearts as the health display. Returns { set(value, max) }. */
export function heartRow(scene, x, y, max, size = 46) {
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
