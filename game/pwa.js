/* global __BUILD__ */
// PWA: install prompt, updates and cache busting.
//
// How a new deploy reaches the player:
//   1. On every start, and whenever the app comes back to the foreground, we ask
//      the service worker to check for a new version (checkForUpdate).
//   2. A new worker activates immediately (autoUpdate) and we reload the page
//      once it takes control, so the fresh build is shown without manual steps.
//   3. Safety net: version.json is fetched uncached. If it names a newer build
//      and no worker update is on its way, we drop all caches and reload
//      (hardRefresh) — this also rescues clients stuck on a very old build.

export const BUILD = typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev';
const IS_DEV = BUILD === 'dev';
const RELOAD_GUARD = 'slld-reloaded-for';

let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

/** Subscribe to install-availability changes. Returns an unsubscribe function. */
export function onInstallChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function isStandalone() {
    return window.matchMedia?.('(display-mode: standalone)').matches
        || window.matchMedia?.('(display-mode: fullscreen)').matches
        || window.navigator.standalone === true;
}

/** True when the browser offered an install prompt we can trigger. */
export function canPromptInstall() {
    return !!deferredPrompt;
}

function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

async function liveBuild() {
    try {
        const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
        return res.ok ? (await res.json()).build : null;
    } catch {
        return null; // offline
    }
}

/** Drop every cache + worker and reload. Guarded so it can never loop. */
async function hardRefresh(target) {
    try {
        if (sessionStorage.getItem(RELOAD_GUARD) === target) return false;
        sessionStorage.setItem(RELOAD_GUARD, target);
    } catch { /* storage blocked: still try once */ }
    const regs = await navigator.serviceWorker?.getRegistrations().catch(() => []) || [];
    await Promise.all(regs.map(r => r.unregister().catch(() => null)));
    const keys = await caches?.keys().catch(() => []) || [];
    await Promise.all(keys.map(k => caches.delete(k)));
    window.location.reload();
    return true;
}

/**
 * Look for a newer build. Returns 'updating' | 'current' | 'offline'.
 * `force` = also hard-refresh when the worker has nothing but version.json differs.
 */
export async function checkForUpdate(force = true) {
    if (IS_DEV) return 'current';
    const reg = await navigator.serviceWorker?.getRegistration().catch(() => null);
    if (reg) {
        await reg.update().catch(() => null);
        if (reg.installing || reg.waiting) return 'updating'; // reload follows on controllerchange
    }
    const live = await liveBuild();
    if (live === null) return 'offline';
    if (live !== BUILD && force) return (await hardRefresh(live)) ? 'updating' : 'current';
    return 'current';
}

if (typeof window !== 'undefined' && !IS_DEV) {
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault(); // keep it so our own button can trigger it
        deferredPrompt = e;
        notify();
    });
    window.addEventListener('appinstalled', () => { deferredPrompt = null; notify(); });

    const sw = navigator.serviceWorker;
    if (sw) {
        // A new worker took control => this page still runs the old build.
        const hadController = !!sw.controller;
        let reloaded = false;
        sw.addEventListener('controllerchange', () => {
            if (!hadController || reloaded) return;
            reloaded = true;
            window.location.reload();
        });
    }
    window.addEventListener('load', () => { setTimeout(() => checkForUpdate(true), 1500); });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate(true);
    });
}

function toast(scene, text) {
    const W = scene.scale.width, H = scene.scale.height;
    const t = scene.add.text(W / 2, H * 0.8, text, {
        fontFamily: 'Arial', fontSize: '34px', color: '#ffffff', align: 'center',
        backgroundColor: '#06343acc', padding: { x: 28, y: 18 }, wordWrap: { width: W * 0.7 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(30000);
    scene.tweens.add({ targets: t, alpha: 0, delay: 4200, duration: 600, onComplete: () => t.destroy() });
}

export async function install(scene, lang) {
    const de = lang === 'de';
    if (isStandalone()) return toast(scene, de ? 'Die App ist schon installiert.' : 'The app is already installed.');
    if (deferredPrompt) {
        const prompt = deferredPrompt;
        deferredPrompt = null;
        notify();
        prompt.prompt();
        await prompt.userChoice.catch(() => null);
        return;
    }
    if (isIos()) {
        return toast(scene, de
            ? 'Auf iPhone/iPad: Teilen-Symbol antippen, dann „Zum Home-Bildschirm".'
            : 'On iPhone/iPad: tap Share, then "Add to Home Screen".');
    }
    toast(scene, de
        ? 'Im Browser-Menü (⋮) „App installieren" bzw. „Zum Startbildschirm hinzufügen" wählen.'
        : 'In the browser menu (⋮) choose "Install app" / "Add to Home screen".');
}

async function manualUpdate(scene, lang) {
    const de = lang === 'de';
    toast(scene, de ? 'Suche nach Update …' : 'Checking for update …');
    try { sessionStorage.removeItem(RELOAD_GUARD); } catch { /* ignore */ }
    const result = await checkForUpdate(true);
    if (result === 'updating') toast(scene, de ? 'Update wird geladen …' : 'Loading update …');
    else if (result === 'offline') toast(scene, de ? `Offline – Build ${BUILD}.` : `Offline – build ${BUILD}.`);
    else toast(scene, de ? `Alles aktuell (Build ${BUILD}).` : `Up to date (build ${BUILD}).`);
}

/** Menu entries for the in-game burger menu. */
export function pwaMenuItems(scene, lang) {
    const de = lang === 'de';
    return [
        { label: de ? 'APP INSTALLIEREN' : 'INSTALL APP', color: 0x1565c0, callback: () => install(scene, lang) },
        { label: 'UPDATE', color: 0x455a64, callback: () => manualUpdate(scene, lang) }
    ];
}
