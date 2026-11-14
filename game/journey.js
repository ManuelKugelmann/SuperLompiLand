// The story path (pure, no Phaser; spec ch.9 "Storyline v2"): the trip east is told in
// chapters, one per biome. Most chapters hold one event you cannot miss: a friend who was
// scattered by the tremor hangs in a ghost net right on the calm route, and Lompi frees them.
// What has been freed is kept for good.

import { BIOMES, WORLD_WEST, WORLD_END, biomeIndexAt } from './level/biomes.js';
import { CHARACTERS } from './characters.js';

export const JOURNEY = {
    at: 0.55,            // where in its biome a chapter's event sits (0 = west end, 1 = east end)
    near: 2600,          // px: the scene of an event is built when the player is this close ...
    far: 4200,           // ... and removed again beyond this
    freeRadius: 190,     // px: swimming this close tears the net
    specialRadius: 420,  // px: a special this close tears it too
    clear: 250,          // px around an event that stay free of coins
    coins: 10            // thank-you coins for each friend freed
};

/** Per biome: who waits there (a character id) and what the chapter asks, in a child's words. */
const CHAPTERS = {
    beach: { goal: { de: 'Schwimm nach Osten, dem roten Leuchten nach', en: 'Swim east, toward the red glow' } },
    mangrove: { friend: 'seahorse', goal: { de: 'Jemand hängt zwischen den Wurzeln fest', en: 'Someone is stuck among the roots' } },
    reef: { friend: 'jellyfish', goal: { de: 'Am Riff zappelt etwas im Netz', en: 'Something wriggles in a net on the reef' } },
    kelp: { friend: 'turtle', goal: { de: 'Im Tangwald ruft jemand um Hilfe', en: 'Someone calls for help in the kelp' } },
    blue: { friend: 'flyingfish', goal: { de: 'Draußen im Blau treibt ein Netz', en: 'A net drifts out in the blue' } },
    wreck: { friend: 'firefish', goal: { de: 'Zwischen den Wracks leuchtet es schwach', en: 'A faint light among the wrecks' } },
    harbour: { friend: 'shark', goal: { de: 'Im Hafen steckt ein großer Freund fest', en: 'A big friend is caught in the harbour' } },
    trench: { goal: { de: 'Ganz unten wartet das große Nest', en: 'The grand nest waits far below' } }
};

const ONWARD = { de: 'Weiter nach Osten!', en: 'Onward, east!' };

/** The chapters west to east: { index, id, name, goal, friend (character or null), x (of its event) }. */
export function chapters(biomes = BIOMES, cfg = JOURNEY) {
    return biomes.map((b, index) => {
        const c = CHAPTERS[b.id] || {};
        return {
            index, id: b.id, name: b.name, goal: c.goal || ONWARD,
            friend: CHARACTERS.find(ch => ch.id === c.friend) || null,
            x: b.from + b.width * cfg.at
        };
    });
}

/**
 * The player's journey. `saved` = ids of friends already freed (from storage).
 *   chapterAt(x)   the chapter this place belongs to
 *   goalAt(x, l)   what to do here, in language l: the chapter's task, or "onward" once it is done
 *   free(id)       mark a friend as freed; true if that was news
 *   has(id), count, total, progress(x) (0..1 across the world), toJSON()
 */
export function createJourney(saved = [], list = chapters()) {
    const freed = new Set((saved || []).filter(id => list.some(c => c.friend?.id === id)));
    const chapterAt = x => list[biomeIndexAt(x)];
    return {
        list,
        chapterAt,
        goalAt(x, lang = 'en') {
            const c = chapterAt(x);
            const g = c.friend && freed.has(c.friend.id) ? ONWARD : c.goal;
            return g[lang] || g.en;
        },
        free(id) {
            if (freed.has(id) || !list.some(c => c.friend?.id === id)) return false;
            freed.add(id);
            return true;
        },
        has: id => freed.has(id),
        get count() { return freed.size; },
        total: list.filter(c => c.friend).length,
        progress: x => Math.max(0, Math.min(1, (x - WORLD_WEST) / (WORLD_END - WORLD_WEST))),
        toJSON: () => [...freed]
    };
}
