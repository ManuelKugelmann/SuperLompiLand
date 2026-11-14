// The story path (pure, no Phaser; spec ch.9 "Storyline v2"): the trip east is told in
// chapters, one per biome. Most chapters hold one event you cannot miss: a friend who was
// scattered by the tremor hangs in a ghost net right on the calm route, and Lompi frees them.
// What has been freed is kept for good. A chapter can hold a second, bigger event (`event`:
// its id and where it starts and ends in the biome), remembered the same way.

import { BIOMES, WORLD_WEST, WORLD_END, biomeIndexAt } from './level/biomes.js';
import { CHARACTERS } from './characters.js';

export const JOURNEY = {
    at: 0.55,            // where in its biome a chapter's event sits (0 = west end, 1 = east end)
    near: 2600,          // px: the scene of an event is built when the player is this close ...
    far: 4200,           // ... and removed again beyond this
    freeRadius: 190,     // px: swimming this close tears the net
    specialRadius: 420,  // px: a special this close tears it too
    clear: 250,          // px around an event that stay free of coins
    eventClear: 1800,    // px before and after a big event's stretch that stay free of hazards
    coins: 10,           // thank-you coins for each friend freed
    standIn: 'lompi'     // who waits in the net of the chapter whose friend the player is playing: nobody rescues themselves
};

/** Per biome: who waits there (a character id) and what the chapter asks, in a child's words. */
const CHAPTERS = {
    // The first friend waits close to the start (`x` = world x instead of the usual place in the biome): within half a minute
    // of the first stroke the child sees what the journey is about.
    beach: { friend: 'seahorse', x: 7600, goal: { de: 'Ganz in der Nähe zappelt jemand im Netz', en: 'Someone is wriggling in a net close by' } },
    mangrove: { goal: { de: 'Weiter nach Osten, zwischen den Wurzeln hindurch', en: 'On east, in between the roots' } },
    reef: { friend: 'jellyfish', goal: { de: 'Am Riff zappelt etwas im Netz', en: 'Something wriggles in a net on the reef' } },
    kelp: { friend: 'turtle', goal: { de: 'Im Tangwald ruft jemand um Hilfe', en: 'Someone calls for help in the kelp' } },
    blue: { friend: 'flyingfish', event: { id: 'whale', from: 0.68, length: 3520 }, goal: { de: 'Draußen im Blau treibt ein Netz', en: 'A net drifts out in the blue' } },
    wreck: { goal: { de: 'Oben tobt ein Sturm! Tauch unten durch das alte Geisterschiff', en: 'A storm rages up top! Dive under it, through the old ghost ship' } },
    shore: { friend: 'firefish', goal: { de: 'An der Felsenküste leuchtet es schwach', en: 'A faint light on the rocky shore' } },
    harbour: { friend: 'shark', goal: { de: 'Im Hafen steckt ein großer Freund fest', en: 'A big friend is caught in the harbour' } },
    trench: { goal: { de: 'Ganz unten wartet das große Nest', en: 'The grand nest waits far below' } }
};

const ONWARD = { de: 'Weiter nach Osten!', en: 'Onward, east!' };

/**
 * The chapters west to east: { index, id, name, goal, friend (character or null), x (of its event) }.
 * `playing` = id of the character the player plays: in the chapter where that friend would wait,
 * the stand-in waits instead (where things are does not change).
 */
export function chapters(biomes = BIOMES, cfg = JOURNEY, playing = null) {
    return biomes.map((b, index) => {
        const c = CHAPTERS[b.id] || {};
        return {
            index, id: b.id, name: b.name, goal: c.goal || ONWARD,
            friend: CHARACTERS.find(ch => ch.id === (c.friend && c.friend === playing ? cfg.standIn : c.friend)) || null,
            x: c.x ?? b.from + b.width * cfg.at,
            event: c.event ? { id: c.event.id, x: b.from + b.width * c.event.from, endX: b.from + b.width * c.event.from + c.event.length } : null
        };
    });
}

/**
 * The player's journey. `saved` = what was freed so far (from storage): chapter ids for the
 * friends and event ids for the big events. A rescue belongs to its chapter, not to who hung in
 * the net: whoever the player plays next time, a net that was emptied stays empty. (Older saves
 * hold character ids; they are read as the chapters those characters wait in.)
 *   chapterAt(x)   the chapter this place belongs to
 *   goalAt(x, l)   what to do here, in language l: the chapter's task, or "onward" once it is done
 *   free(id)       mark a friend (by character id) as freed, or an event (by its id) as done; true if that was news
 *   event(id)      the big event with that id, or null
 *   has(id), count, total, friends(), progress(x) (0..1 across the world), toJSON()
 */
export function createJourney(saved = [], list = chapters()) {
    const chapterOf = id => list.find(c => c.friend?.id === id), isEvent = id => list.some(c => c.event?.id === id);
    const home = chapters();      // who waits where when Lompi is played: how older saves named a rescue
    const freed = new Set();
    for (const id of saved || []) {
        if (isEvent(id) || list.some(c => c.id === id && c.friend)) freed.add(id);
        else { const old = home.find(c => c.friend?.id === id); if (old) freed.add(old.id); }
    }
    const chapterAt = x => list[biomeIndexAt(x)];
    return {
        list,
        chapterAt,
        goalAt(x, lang = 'en') {
            const c = chapterAt(x);
            const g = c.friend && freed.has(c.id) ? ONWARD : c.goal;
            return g[lang] || g.en;
        },
        free(id) {
            const key = chapterOf(id)?.id ?? (isEvent(id) ? id : null);
            if (key === null || freed.has(key)) return false;
            freed.add(key);
            return true;
        },
        has: id => freed.has(chapterOf(id)?.id ?? id),
        event: id => list.find(c => c.event?.id === id)?.event || null,
        get count() { return list.filter(c => c.friend && freed.has(c.id)).length; },
        /** The freed friends as character ids, west to east (who came along, for the end screen). */
        friends: () => list.filter(c => c.friend && freed.has(c.id)).map(c => c.friend.id),
        total: list.filter(c => c.friend).length,
        progress: x => Math.max(0, Math.min(1, (x - WORLD_WEST) / (WORLD_END - WORLD_WEST))),
        toJSON: () => [...freed]
    };
}
