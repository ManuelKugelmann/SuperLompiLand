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

/** Only the game's own pages may call the relay. */
export function originAllowed(origin, allowedOrigins) {
    return !!origin && allowedOrigins.some(o => o === origin);
}

/** Issue title + body from a feedback message. */
export function buildIssue(text, context) {
    const clean = sanitize(text);
    const firstLine = clean.split('\n')[0].slice(0, 70) || 'Feedback';
    const ctx = Object.entries(context && typeof context === 'object' ? context : {})
        .slice(0, 12)
        .map(([k, v]) => `- ${sanitize(k, 30)}: ${sanitize(v, 80)}`)
        .join('\n')
        .slice(0, LIMITS.contextMax);
    return {
        title: `Feedback: ${firstLine}`,
        body: `${clean}\n\n---\n${ctx || '- (no context)'}`,
        labels: ['player-feedback']
    };
}
