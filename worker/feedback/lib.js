// Pure helpers for the feedback relay (no Cloudflare APIs) — unit-tested in
// tests/feedback.test.mjs.

export const LIMITS = { perHour: 42, textMax: 1000, contextMax: 600 };

/** Trim, drop control characters, defuse @mentions and HTML, cap the length. */
export function sanitize(text, max = LIMITS.textMax) {
    return String(text ?? '')
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
        .replace(/@/g, '@​')
        .replace(/</g, '&lt;')
        .trim()
        .slice(0, max);
}

/** Rate-limit bucket key: one counter per clock hour (UTC). */
export function hourBucket(now = Date.now()) {
    return `feedback:${new Date(now).toISOString().slice(0, 13)}`;
}

/**
 * Is the sender where the family is? `allowed` comes from the worker's settings
 * (any of country / region / city may be empty = not checked). Comparison is
 * case-insensitive. Note: IP location is approximate — mobile networks often
 * report a different city — so this is a filter against strangers, not a lock.
 */
export function placeAllowed(cf, allowed) {
    const same = (a, b) => !b || String(a ?? '').toLowerCase() === String(b).toLowerCase();
    return same(cf?.country, allowed.country) && same(cf?.region, allowed.region) && same(cf?.city, allowed.city);
}

const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

function editDistance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
    }
    return d[a.length][b.length];
}

/**
 * Who is writing? Returns the allowed name the input matches (ignoring case,
 * accents and one typo), or null. Only that canonical name is ever stored.
 */
export function matchName(input, allowedNames) {
    const name = norm(input);
    if (!name) return null;
    return allowedNames.map(norm).filter(Boolean).find(a => a === name || editDistance(a, name) <= 1) ?? null;
}

/** Only the game's own pages may call the relay. */
export function originAllowed(origin, allowedOrigins) {
    return !!origin && allowedOrigins.some(o => o === origin);
}

/** Issue title + body from a feedback message. */
export function buildIssue(text, context, from = '') {
    const clean = sanitize(text);
    const firstLine = clean.split('\n')[0].slice(0, 70) || 'Feedback';
    const ctx = Object.entries(context && typeof context === 'object' ? context : {})
        .slice(0, 12)
        .map(([k, v]) => `- ${sanitize(k, 30)}: ${sanitize(v, 80)}`)
        .join('\n')
        .slice(0, LIMITS.contextMax);
    return {
        title: `Feedback: ${firstLine}`,
        body: `${clean}\n\n---\n${from ? `- from: ${sanitize(from, 30)}\n` : ''}${ctx || '- (no context)'}`,
        labels: ['player-feedback']
    };
}
