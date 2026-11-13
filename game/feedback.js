// In-game feedback box: type, send — it becomes an issue for the developers.
// The message goes to a small relay (worker/feedback) that holds the access
// token; nothing secret is in the game. Until FEEDBACK_URL is set the entry is
// simply not offered.
import { VERSION_TAG } from './pwa.js';

export const FEEDBACK_URL = ''; // e.g. 'https://lompi-feedback.<account>.workers.dev'

const CODE_KEY = 'sll_family_code';
const NAME_KEY = 'sll_feedback_name';
const QUEUE_KEY = 'sll_feedback_queue';
const store = {
    get: (k, d) => { try { return JSON.parse(window.localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { window.localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked */ } }
};

export const feedbackEnabled = () => !!FEEDBACK_URL;

async function post(entry) {
    const res = await fetch(FEEDBACK_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...entry, code: store.get(CODE_KEY, ''), name: store.get(NAME_KEY, '') })
    });
    return res.status;
}

/** Messages written offline are kept and sent on the next start. */
export async function flushFeedbackQueue() {
    if (!feedbackEnabled() || !navigator.onLine) return;
    const queue = store.get(QUEUE_KEY, []);
    while (queue.length) {
        try {
            const status = await post(queue[0]);
            if (status >= 500 || status === 429) break; // try again later
        } catch { break; }
        queue.shift();
        store.set(QUEUE_KEY, queue);
    }
}

const TEXT = {
    de: {
        title: 'Feedback', hint: 'Was gefällt dir? Was stört? Was fehlt?', send: 'Senden', cancel: 'Abbrechen',
        code: 'Familien-Code (falls ihr einen habt)', name: 'Dein Vorname', badName: 'Name oder Code stimmt nicht.', sent: 'Danke! Ist angekommen.', queued: 'Gespeichert – wird gesendet, sobald du online bist.',
        badCode: 'Der Familien-Code stimmt nicht.', place: 'Feedback geht nur von zu Hause aus.',
        rate: 'Gerade zu viele Nachrichten – bitte später nochmal.', fail: 'Das hat nicht geklappt. Bitte später nochmal.'
    },
    en: {
        title: 'Feedback', hint: 'What do you like? What bothers you? What is missing?', send: 'Send', cancel: 'Cancel',
        code: 'Family code (if you have one)', name: 'Your first name', badName: 'Name or code is not right.', sent: 'Thanks! Got it.', queued: 'Saved – will be sent once you are online.',
        badCode: 'The family code is not right.', place: 'Feedback only works from home.',
        rate: 'Too many messages right now – please try later.', fail: 'That did not work. Please try later.'
    }
};

/**
 * Open the box (a plain HTML overlay, so the phone keyboard works).
 * `context()` returns a small object describing where the player is; no personal data.
 */
export function openFeedback(lang, context) {
    if (!feedbackEnabled() || document.getElementById('sll-feedback')) return;
    const t = TEXT[lang] || TEXT.en;
    const needCode = !store.get(CODE_KEY, '');
    const wrap = document.createElement('div');
    wrap.id = 'sll-feedback';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:1000;background:rgba(4,26,40,.82);display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;touch-action:auto;user-select:text;-webkit-user-select:text';
    wrap.innerHTML = `
      <div style="background:#0d5568;color:#fff;border-radius:18px;padding:22px;width:min(92vw,560px);box-shadow:0 10px 40px rgba(0,0,0,.5)">
        <div style="font-size:26px;font-weight:bold;margin-bottom:10px">${t.title}</div>
        <textarea maxlength="1000" placeholder="${t.hint}" style="width:100%;height:150px;box-sizing:border-box;font-size:18px;padding:12px;border-radius:12px;border:0;resize:none"></textarea>
        <input data-name type="text" autocomplete="off" maxlength="20" placeholder="${t.name}" style="width:100%;box-sizing:border-box;font-size:18px;padding:12px;border-radius:12px;border:0;margin-top:10px">
        ${needCode ? `<input data-code type="text" inputmode="text" autocomplete="off" placeholder="${t.code}" style="width:100%;box-sizing:border-box;font-size:18px;padding:12px;border-radius:12px;border:0;margin-top:10px">` : ''}
        <div data-msg style="min-height:24px;margin:10px 0;font-size:16px;color:#ffe08a"></div>
        <div style="display:flex;gap:12px;justify-content:flex-end">
          <button data-cancel style="font-size:18px;padding:12px 20px;border-radius:12px;border:0;background:#33555f;color:#fff">${t.cancel}</button>
          <button data-send style="font-size:18px;padding:12px 26px;border-radius:12px;border:0;background:#ffc266;color:#06343a;font-weight:bold">${t.send}</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const area = wrap.querySelector('textarea'), codeInput = wrap.querySelector('[data-code]'), nameInput = wrap.querySelector('[data-name]');
    nameInput.value = store.get(NAME_KEY, '');
    const msg = wrap.querySelector('[data-msg]'), sendBtn = wrap.querySelector('[data-send]');
    const close = () => wrap.remove();
    // Keep key and pointer events away from the game underneath.
    for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click']) {
        wrap.addEventListener(type, e => e.stopPropagation());
    }
    wrap.querySelector('[data-cancel]').addEventListener('click', close);
    area.focus();

    sendBtn.addEventListener('click', async () => {
        const text = area.value.trim();
        if (!text) return;
        if (codeInput?.value.trim()) store.set(CODE_KEY, codeInput.value.trim());
        store.set(NAME_KEY, nameInput.value.trim());
        const entry = { text, context: { version: VERSION_TAG, ...context() } };
        sendBtn.disabled = true;
        let status = 0;
        try { status = navigator.onLine ? await post(entry) : 0; } catch { status = 0; }
        if (status === 200) { msg.textContent = t.sent; setTimeout(close, 1200); return; }
        if (status === 0) {
            store.set(QUEUE_KEY, [...store.get(QUEUE_KEY, []), entry].slice(-10));
            msg.textContent = t.queued; setTimeout(close, 1800); return;
        }
        if (status === 401) { store.set(CODE_KEY, ''); msg.textContent = t.badName; }
        else if (status === 403) msg.textContent = t.place;
        else if (status === 429) msg.textContent = t.rate;
        else msg.textContent = t.fail;
        sendBtn.disabled = false;
    });
}

/** Menu entry, or nothing while no relay is configured. */
export function feedbackMenuItems(lang, context) {
    return feedbackEnabled()
        ? [{ label: 'FEEDBACK', color: 0x7b1fa2, callback: () => openFeedback(lang, context) }]
        : [];
}
