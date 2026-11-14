// Credits: who made the game and whose free assets it uses. Shown as a plain DOM
// overlay from the menu; the same list is in README.md (Credits).

export const CREDITS = {
    de: {
        title: 'Danke!',
        lines: [
            'Ein Spiel von Familie Kugelmann',
            'Stein- und Metalloberflächen: ambientCG.com (CC0)',
            'Wracks, Fässer, Kisten und Felsen: Poly Haven (CC0)',
            'Gemacht mit Phaser, Matter.js und Vite (MIT)',
            'Mehrspieler über Trystero (MIT)'
        ],
        close: 'Schließen'
    },
    en: {
        title: 'Thank you!',
        lines: [
            'A game by Familie Kugelmann',
            'Stone and metal surfaces: ambientCG.com (CC0)',
            'Wrecks, barrels, crates and boulders: Poly Haven (CC0)',
            'Made with Phaser, Matter.js and Vite (MIT)',
            'Multiplayer via Trystero (MIT)'
        ],
        close: 'Close'
    }
};

export function openCredits(lang) {
    const t = CREDITS[lang] || CREDITS.en;
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;background:rgba(2,20,40,.72);font-family:Arial,sans-serif';
    const card = document.createElement('div');
    card.style.cssText = 'max-width:min(90vw,560px);padding:24px 28px;border-radius:18px;background:#0d4a78;color:#fff;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.4)';
    const h = document.createElement('h2');
    h.textContent = t.title;
    h.style.margin = '0 0 12px';
    card.append(h);
    for (const line of t.lines) {
        const p = document.createElement('p');
        p.textContent = line;
        p.style.margin = '6px 0';
        card.append(p);
    }
    const btn = document.createElement('button');
    btn.textContent = t.close;
    btn.style.cssText = 'margin-top:14px;padding:10px 26px;border:0;border-radius:12px;background:#ffc266;color:#123;font-size:18px;font-weight:bold';
    card.append(btn);
    box.append(card);
    const close = () => box.remove();
    btn.onclick = close;
    box.onclick = e => { if (e.target === box) close(); };
    document.body.append(box);
}
