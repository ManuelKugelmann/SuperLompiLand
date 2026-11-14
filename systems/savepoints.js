// Savepoints (pure, no Phaser; user request 2026-11-14: "safepoints, loadable at start,
// store in cookie"). Every nest reached is a savepoint: where the player was, the coins
// banked there, the character, the friends freed and the play style. The list lives in
// one small cookie (world bitfields stay in localStorage), so a cleared localStorage or
// a new tab still offers "continue from the reef". The title screen lists them.

export const SAVE = {
    cookie: 'sll_saves',     // cookie name
    days: 365,               // kept this long after the last save
    max: 12                  // savepoints kept (one per nest; the world has fewer)
};

/** A savepoint from the game state; `biome` = id of the area the nest is in; `t` = ms timestamp. */
export function savepoint({ nest, coins, character, journey = [], relaxed = false, biome = '', t = Date.now() }) {
    return { n: nest | 0, b: String(biome).slice(0, 24), c: Math.max(0, coins | 0), ch: String(character || 'lompi').slice(0, 24), j: [...journey].slice(0, 16).map(String), r: !!relaxed, t };
}

/** Add or replace the savepoint of the same nest; the list stays sorted by nest. */
export function addSavepoint(list, sp) {
    const out = (Array.isArray(list) ? list : []).filter(s => s && s.n !== sp.n);
    out.push(sp);
    out.sort((a, b) => a.n - b.n);
    return out.slice(-SAVE.max);
}

/** The newest savepoint (highest time), or null. */
export const latest = list => (list?.length ? list.reduce((a, b) => (b.t > a.t ? b : a)) : null);

/** List <-> cookie-safe text (URI-encoded JSON). Bad or foreign text gives []. */
export const encode = list => encodeURIComponent(JSON.stringify(list));
export function decode(text) {
    try {
        const v = JSON.parse(decodeURIComponent(text || ''));
        return Array.isArray(v) ? v.filter(s => s && Number.isInteger(s.n) && s.n >= 0).map(s => savepoint({ nest: s.n, coins: s.c, character: s.ch, journey: Array.isArray(s.j) ? s.j : [], relaxed: s.r, biome: s.b || '', t: Number(s.t) || 0 })) : [];
    } catch { return []; }
}

/** Read the list from a `document.cookie` string. */
export function fromCookie(cookieString) {
    const hit = String(cookieString || '').split(/;\s*/).find(p => p.startsWith(`${SAVE.cookie}=`));
    return hit ? decode(hit.slice(SAVE.cookie.length + 1)) : [];
}

/** The `document.cookie = ...` assignment that stores the list. */
export const toCookie = list => `${SAVE.cookie}=${encode(list)}; max-age=${SAVE.days * 86400}; path=/; SameSite=Lax`;
