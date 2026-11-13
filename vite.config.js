import { defineConfig } from 'vite';
import { gameViteConfig } from '@gks/sdk/host/viteGameConfig.js';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

// Standalone build/dev config. We take the shared preset (base './', single
// Phaser instance, dev server) and ADD a PWA layer on top via an override, so
// the game is installable standalone without modifying the shared preset.
// One stamp per build: baked into the bundle AND written to version.json, which
// the running app fetches uncached to notice that a newer build is live.
const BUILD = new Date().toISOString().slice(0, 19).replace('T', ' ');
const VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
const versionFile = {
    name: 'version-json',
    apply: 'build',
    generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: VERSION, build: BUILD }) });
    }
};

export default defineConfig(({ command }) =>
    gameViteConfig({
        define: {
            __BUILD__: JSON.stringify(command === 'build' ? BUILD : 'dev'),
            __VERSION__: JSON.stringify(VERSION)
        },
        plugins: [
            versionFile,
            VitePWA({
                registerType: 'autoUpdate',
                manifest: false, // we ship our own public/manifest.json (portal pattern)
                workbox: {
                    cleanupOutdatedCaches: true,
                    // version.json must always come from the network.
                    navigateFallbackDenylist: [/version\.json$/],
                    globPatterns: ['**/*.{js,css,html,ico,png,jpg,svg,webp,woff2}'],
                    maximumFileSizeToCacheInBytes: 10_000_000
                },
                devOptions: {
                    enabled: false // no SW in dev — avoids caching headaches (portal pattern)
                }
            })
        ]
    })
);
