import { defineConfig } from 'vite';
import { gameViteConfig } from '@gks/sdk/host/viteGameConfig.js';
import { VitePWA } from 'vite-plugin-pwa';

// Standalone build/dev config. We take the shared preset (base './', single
// Phaser instance, dev server) and ADD a PWA layer on top via an override, so
// the game is installable standalone without modifying the shared preset.
export default defineConfig(
    gameViteConfig({
        plugins: [
            VitePWA({
                registerType: 'autoUpdate',
                manifest: false, // we ship our own public/manifest.json (portal pattern)
                workbox: {
                    globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
                    maximumFileSizeToCacheInBytes: 10_000_000
                },
                devOptions: {
                    enabled: false // no SW in dev — avoids caching headaches (portal pattern)
                }
            })
        ]
    })
);
