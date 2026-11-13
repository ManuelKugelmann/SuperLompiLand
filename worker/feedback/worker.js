// Feedback relay (Cloudflare Worker).
//
// The game posts { text, context, code } here; the worker checks who is asking
// and files a GitHub issue. The GitHub token never leaves the worker.
//
// Settings (wrangler.toml [vars] / `wrangler secret put`):
//   GITHUB_TOKEN     secret — fine-grained token, Issues: read & write, this repo only
//   GITHUB_REPO      "owner/repo"
//   ALLOWED_ORIGINS  comma-separated page origins that may post
//   ALLOWED_NAMES    secret, optional — comma-separated first names; if set, the
//                    sender's name must match one of them (case, accents and one
//                    typo are forgiven). Kept out of the public repo on purpose.
//   FAMILY_CODE      secret, optional — if set, posts must carry this code
//   ALLOWED_COUNTRY / ALLOWED_REGION / ALLOWED_CITY   optional place filter
// Binding: KV namespace RATE (hourly counter).
import { LIMITS, sanitize, hourBucket, placeAllowed, originAllowed, buildIssue, matchName } from './lib.js';

const json = (status, body, origin) => new Response(JSON.stringify(body), {
    status,
    headers: {
        'content-type': 'application/json',
        ...(origin ? { 'access-control-allow-origin': origin, vary: 'origin' } : {})
    }
});

export default {
    async fetch(request, env) {
        const origin = request.headers.get('origin');
        const origins = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
        const ok = originAllowed(origin, origins);

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: ok ? 204 : 403,
                headers: ok ? {
                    'access-control-allow-origin': origin,
                    'access-control-allow-methods': 'POST',
                    'access-control-allow-headers': 'content-type',
                    'access-control-max-age': '86400'
                } : {}
            });
        }
        if (request.method !== 'POST') return json(405, { error: 'method' });
        if (!ok) return json(403, { error: 'origin' });

        if (!placeAllowed(request.cf, { country: env.ALLOWED_COUNTRY, region: env.ALLOWED_REGION, city: env.ALLOWED_CITY })) {
            return json(403, { error: 'place' }, origin);
        }

        let data;
        try { data = await request.json(); } catch { return json(400, { error: 'json' }, origin); }
        if (env.FAMILY_CODE && String(data.code ?? '') !== env.FAMILY_CODE) return json(401, { error: 'code' }, origin);
        let from = '';
        if (env.ALLOWED_NAMES) {
            from = matchName(data.name, env.ALLOWED_NAMES.split(','));
            if (!from) return json(401, { error: 'name' }, origin);
        }
        if (!sanitize(data.text)) return json(400, { error: 'empty' }, origin);

        // 42 per hour, all senders together.
        const bucket = hourBucket();
        const count = parseInt(await env.RATE.get(bucket), 10) || 0;
        if (count >= LIMITS.perHour) return json(429, { error: 'rate' }, origin);
        await env.RATE.put(bucket, String(count + 1), { expirationTtl: 7200 });

        const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
            method: 'POST',
            headers: {
                authorization: `Bearer ${env.GITHUB_TOKEN}`,
                accept: 'application/vnd.github+json',
                'user-agent': 'feedback-relay',
                'content-type': 'application/json'
            },
            body: JSON.stringify(buildIssue(data.text, data.context, from))
        });
        if (!res.ok) return json(502, { error: 'github', status: res.status }, origin);
        return json(200, { ok: true }, origin);
    }
};
