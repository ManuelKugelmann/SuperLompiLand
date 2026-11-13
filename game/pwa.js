/* global __BUILD__ */
// PWA helpers: install prompt + manual update check, surfaced as menu items.
// (The service worker also auto-updates on launch — registerType 'autoUpdate'.)

let deferredPrompt = null;

if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault(); // keep it so we can trigger it from our own button
        deferredPrompt = e;
    });
    window.addEventListener('appinstalled', () => { deferredPrompt = null; });
}

export const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';

function isStandalone() {
    return window.matchMedia?.('(display-mode: standalone)').matches
        || window.matchMedia?.('(display-mode: fullscreen)').matches
        || window.navigator.standalone === true;
}

function toast(scene, text) {
    const W = scene.scale.width, H = scene.scale.height;
    const t = scene.add.text(W / 2, H * 0.8, text, {
        fontFamily: 'Arial', fontSize: '34px', color: '#ffffff', align: 'center',
        backgroundColor: '#06343acc', padding: { x: 28, y: 18 }, wordWrap: { width: W * 0.7 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(30000);
    scene.tweens.add({ targets: t, alpha: 0, delay: 3200, duration: 600, onComplete: () => t.destroy() });
}

async function install(scene, de) {
    if (isStandalone()) return toast(scene, de ? 'Die App ist schon installiert.' : 'The app is already installed.');
    if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice.catch(() => null);
        deferredPrompt = null;
        return;
    }
    toast(scene, de
        ? 'Im Browser-Menü „Zum Startbildschirm hinzufügen" bzw. „App installieren" wählen.'
        : 'Use your browser menu: "Add to Home Screen" / "Install app".');
}

async function update(scene, de) {
    const reg = await navigator.serviceWorker?.getRegistration().catch(() => null);
    if (!reg) return toast(scene, de ? `Kein Offline-Modus aktiv (Build ${BUILD}).` : `No offline mode active (build ${BUILD}).`);
    toast(scene, de ? 'Suche nach Update …' : 'Checking for update …');
    await reg.update().catch(() => null);
    const pending = reg.installing || reg.waiting;
    if (!pending) return toast(scene, de ? `Alles aktuell (Build ${BUILD}).` : `Up to date (build ${BUILD}).`);
    const reload = () => window.location.reload();
    if (pending.state === 'activated') return reload();
    pending.addEventListener('statechange', () => { if (pending.state === 'activated') reload(); });
    pending.postMessage?.({ type: 'SKIP_WAITING' });
}

/** Menu entries for the in-game burger menu. */
export function pwaMenuItems(scene, lang) {
    const de = lang === 'de';
    return [
        { label: de ? 'APP INSTALLIEREN' : 'INSTALL APP', color: 0x1565c0, callback: () => install(scene, de) },
        { label: 'UPDATE', color: 0x455a64, callback: () => update(scene, de) }
    ];
}
