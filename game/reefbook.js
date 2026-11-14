// The reef book (pure, no Phaser; spec gamedesign §5.2d): a discovery journal.
// Every creature, place and thing people left behind is an entry that fills in when
// Lompi sees it up close. One real, kid-friendly fact per entry. Pass/fail, no
// scores and never a gate (spec 2.1): finding things is its own reward.

/** kind: 'creature' | 'place' | 'leftover'. `image` = texture key (places: the place's typical sight;
 *  a missing texture is drawn as a badge in the place's colours). */
export const ENTRIES = [
    // Creatures (keys as in the level's friend table)
    { id: 'friend_turtle', kind: 'creature', image: 'friend_turtle',
        name: { de: 'Meeresschildkröte', en: 'Sea turtle' },
        fact: { de: 'Sie kann stundenlang unter Wasser schlafen, ohne zu atmen.', en: 'It can sleep underwater for hours without taking a breath.' } },
    { id: 'friend_jellyfish', kind: 'creature', image: 'friend_jellyfish',
        name: { de: 'Qualle', en: 'Jellyfish' },
        fact: { de: 'Quallen haben kein Gehirn und keine Knochen und bestehen fast nur aus Wasser.', en: 'Jellyfish have no brain and no bones and are almost all water.' } },
    { id: 'friend_seahorse', kind: 'creature', image: 'friend_seahorse',
        name: { de: 'Seepferdchen', en: 'Seahorse' },
        fact: { de: 'Beim Seepferdchen trägt der Papa die Babys in einer Bauchtasche.', en: 'Seahorse dads carry the babies in a pouch on their belly.' } },
    { id: 'friend_starfish', kind: 'creature', image: 'friend_starfish',
        name: { de: 'Seestern', en: 'Starfish' },
        fact: { de: 'Ein Seestern kann einen verlorenen Arm wieder nachwachsen lassen.', en: 'A starfish can grow back a lost arm.' } },
    { id: 'friend_snail', kind: 'creature', image: 'friend_snail',
        name: { de: 'Meeresschnecke', en: 'Sea snail' },
        fact: { de: 'Meeresschnecken atmen mit Kiemen und tragen ihr Haus ein Leben lang.', en: 'Sea snails breathe with gills and carry their house all their life.' } },
    { id: 'friend_nudibranch', kind: 'creature', image: 'friend_nudibranch',
        name: { de: 'Nacktschnecke', en: 'Nudibranch' },
        fact: { de: 'Ihre bunten Farben warnen hungrige Fische: Friss mich lieber nicht!', en: 'Its bright colours warn hungry fish: better not eat me!' } },
    { id: 'giant_clam', kind: 'creature', image: 'giant_clam',
        name: { de: 'Riesenmuschel', en: 'Giant clam' },
        fact: { de: 'Riesenmuscheln werden über hundert Jahre alt und so schwer wie zwei erwachsene Menschen.', en: 'Giant clams live for over a hundred years and can weigh as much as two grown-ups.' } },
    { id: 'urchin', kind: 'creature', image: 'urchin',
        name: { de: 'Seeigel', en: 'Sea urchin' },
        fact: { de: 'Seeigel laufen auf hunderten winzigen Saugfüßchen zwischen ihren Stacheln.', en: 'Sea urchins walk on hundreds of tiny tube feet between their spines.' } },
    { id: 'enemy_angler', kind: 'creature', image: 'enemy_angler',
        name: { de: 'Anglerfisch', en: 'Anglerfish' },
        fact: { de: 'Sein Leuchtköder leuchtet, weil darin winzige Bakterien leben.', en: 'Its glowing lure shines because tiny bacteria live inside it.' } },
    // Shoals (ids `school_<species>` as in ai/SwarmLayer.js SPECIES)
    { id: 'school_anthias', kind: 'creature', image: 'school_anthias',
        name: { de: 'Fahnenbarsch', en: 'Anthias' },
        fact: { de: 'Fahnenbarsche leben in großen Gruppen. Fehlt das Männchen, kann sich ein Weibchen in ein Männchen verwandeln.', en: 'Anthias live in big groups. If the male is gone, a female can turn into a male.' } },
    { id: 'school_tang', kind: 'creature', image: 'school_tang',
        name: { de: 'Gelber Doktorfisch', en: 'Yellow tang' },
        fact: { de: 'Der weiße Dorn am Schwanz ist scharf wie ein Skalpell. Darum heißen Doktorfische so.', en: 'The white spine by its tail is as sharp as a scalpel. That is why tangs are also called surgeonfish.' } },
    { id: 'school_fry', kind: 'creature', image: 'school_fry',
        name: { de: 'Fischbrut', en: 'Fish fry' },
        fact: { de: 'Junge Fische heißen Fischbrut. Tausende schlüpfen auf einmal und verstecken sich zwischen den Wurzeln.', en: 'Baby fish are called fry. Thousands hatch at once and hide between the roots.' } },
    { id: 'school_silverside', kind: 'creature', image: 'school_silverside',
        name: { de: 'Ährenfisch', en: 'Silverside' },
        fact: { de: 'Im Schwarm drehen alle blitzschnell zusammen. Das verwirrt Jäger: Sie können keinen einzelnen Fisch herauspicken.', en: 'In a shoal they all turn together in a flash. It confuses hunters, who cannot pick out a single fish.' } },
    { id: 'school_lantern', kind: 'creature', image: 'school_lantern',
        name: { de: 'Laternenfisch', en: 'Lanternfish' },
        fact: { de: 'Laternenfische machen ihr eigenes Licht: mit kleinen Leuchtpunkten am Bauch.', en: 'Lanternfish make their own light with little glowing dots on their belly.' } },
    // Places (ids as in biomes.js)
    { id: 'whale', kind: 'creature', image: 'whale',
        name: { de: 'Buckelwal', en: 'Humpback whale' },
        fact: { de: 'Buckelwale singen lange Lieder, die man unter Wasser kilometerweit hört.', en: 'Humpback whales sing long songs that can be heard for miles underwater.' } },
    { id: 'gannet', kind: 'creature', image: 'gannet_float',
        name: { de: 'Basstölpel', en: 'Gannet' },
        fact: { de: 'Basstölpel stürzen sich aus 30 Metern Höhe kopfüber ins Meer, um Fische zu fangen.', en: 'Gannets dive head first into the sea from 30 metres up to catch fish.' } },
    { id: 'glow_jelly', kind: 'creature', image: 'glow_jelly',
        name: { de: 'Leuchtqualle', en: 'Glowing jelly' },
        fact: { de: 'In der dunklen Tiefe machen viele Tiere ihr eigenes Licht, um zu jagen oder sich zu verstecken.', en: 'In the dark deep many animals make their own light, to hunt or to hide.' } },
    { id: 'ghost_ship', kind: 'place', image: 'ghost_ship',
        name: { de: 'Geisterschiff', en: 'Ghost ship' },
        fact: { de: 'Alte Wracks werden zu Riffen: Korallen wachsen darauf, und Fische ziehen ein.', en: 'Old wrecks turn into reefs: corals grow on them and fish move in.' } },
    { id: 'beach', kind: 'place', image: 'seagrass_1',
        name: { de: 'Sandstrand', en: 'Sandy beach' },
        fact: { de: 'Heller Strandsand besteht oft aus winzigen Stücken von Muscheln und Korallen.', en: 'Pale beach sand is often made of tiny bits of shells and coral.' } },
    { id: 'reef', kind: 'place', image: 'coral_1',
        name: { de: 'Korallenriff', en: 'Coral reef' },
        fact: { de: 'Riffe werden von winzigen Tieren gebaut: den Korallenpolypen.', en: 'Reefs are built by tiny animals called coral polyps.' } },
    { id: 'mangrove', kind: 'place', image: 'root_1',
        name: { de: 'Mangroven', en: 'Mangroves' },
        fact: { de: 'Zwischen den Wurzeln wachsen viele junge Fische geschützt auf.', en: 'Many young fish grow up safely between the roots.' } },
    { id: 'kelp', kind: 'place', image: 'kelp_stalk_1',
        name: { de: 'Tangwald', en: 'Seaweed forest' },
        fact: { de: 'Riesentang kann an einem einzigen Tag über 30 Zentimeter wachsen.', en: 'Giant kelp can grow more than 30 centimetres in a single day.' } },
    { id: 'blue', kind: 'place', image: 'school_silverside',
        name: { de: 'Blaues Meer', en: 'Open blue' },
        fact: { de: 'Das offene Meer bedeckt mehr von unserer Erde als alles Land zusammen.', en: 'The open ocean covers more of our planet than all the land together.' } },
    { id: 'wreck', kind: 'place', image: 'wreck_1',
        name: { de: 'Schiffsfriedhof', en: 'Ship graveyard' },
        fact: { de: 'Mit den Jahren werden versunkene Schiffe zu einem Zuhause für Korallen und Fische.', en: 'Over the years sunken ships become a home for corals and fish.' } },
    { id: 'shore', kind: 'place', image: 'urchin',
        name: { de: 'Felsenküste', en: 'Rocky shore' },
        fact: { de: 'Wo Wellen an Felsen schlagen, halten sich Seeigel und Seesterne mit hunderten kleinen Füßchen fest.', en: 'Where waves beat on rock, urchins and starfish hold on with hundreds of tiny feet.' } },
    { id: 'harbour', kind: 'place', image: 'trawler_1',
        name: { de: 'Hafen', en: 'Harbour' },
        fact: { de: 'An Hafenmauern und Pfählen leben Muscheln, Krebse und viele Fische.', en: 'Mussels, crabs and many fish live on harbour walls and piles.' } },
    { id: 'trench', kind: 'place', image: 'school_lantern',
        name: { de: 'Tiefsee', en: 'Deep sea' },
        fact: { de: 'Die tiefste Stelle des Meeres liegt fast 11 Kilometer unter der Oberfläche.', en: 'The deepest point of the ocean is almost 11 kilometres down.' } },
    // Things people left behind (keys as in the level's hazard table)
    { id: 'hazard_net', kind: 'leftover', image: 'hazard_net',
        name: { de: 'Geisternetz', en: 'Ghost net' },
        fact: { de: 'Verlorene Fischernetze fangen noch jahrelang Tiere. Darum heißen sie Geisternetze.', en: 'Lost fishing nets keep catching animals for years. That is why they are called ghost nets.' } },
    { id: 'hazard_buoy', kind: 'leftover', image: 'hazard_buoy',
        name: { de: 'Ölfass', en: 'Oil drum' },
        fact: { de: 'Öl schwimmt oben und verklebt Federn und Fell. Darum ist es so schlimm fürs Meer.', en: 'Oil floats and sticks to feathers and fur. That is why it is so bad for the sea.' } },
    { id: 'mine', kind: 'leftover', image: 'mine',
        name: { de: 'Verlorener Anker', en: 'Lost anchor' },
        fact: { de: 'Schleifende Anker und Ketten können Korallen am Meeresboden zerstören.', en: 'Dragging anchors and chains can scrape away corals on the seabed.' } },
    { id: 'spikes', kind: 'leftover', image: 'spikes',
        name: { de: 'Wrackschrott', en: 'Wreck scrap' },
        fact: { de: 'Scharfes Metall rostet langsam, über viele Jahre, bis es ganz verschwindet.', en: 'Sharp metal rusts away slowly, over many years, until it is gone.' } }
];
export const KINDS = ['creature', 'place', 'leftover'];
const BY_ID = new Map(ENTRIES.map(e => [e.id, e]));
export const entryFor = id => BY_ID.get(id) || null;

/** The book of one save: what was found, in order. `saved` = list of ids (from storage). */
export function createBook(saved = []) {
    const found = new Set((Array.isArray(saved) ? saved : []).filter(id => BY_ID.has(id)));
    return {
        /** Mark an id as seen; returns its entry the first time, otherwise null. */
        discover(id) {
            if (!BY_ID.has(id) || found.has(id)) return null;
            found.add(id);
            return BY_ID.get(id);
        },
        has: id => found.has(id),
        /** Entries of one kind (or all), each with `found`. */
        entries(kind) { return ENTRIES.filter(e => !kind || e.kind === kind).map(e => ({ ...e, found: found.has(e.id) })); },
        progress() { return { found: found.size, total: ENTRIES.length }; },
        toJSON() { return [...found]; }
    };
}
