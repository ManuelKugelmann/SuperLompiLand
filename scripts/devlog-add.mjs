// Adds one entry to the dev log.
//   node scripts/devlog-add.mjs <screenshot.jpg> "<what it shows>"
// Copies the screenshot into docs/devlog/, puts the entry (linked to the current
// HEAD commit) at the top of docs/devlog/README.md and refreshes the
// "Dev log" section in the main README with the newest screenshots.
import { execSync } from 'node:child_process';
import { copyFileSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOG_DIR = resolve(ROOT, 'docs/devlog');
const LOG = resolve(LOG_DIR, 'README.md');
const README = resolve(ROOT, 'README.md');
const SHOWN = 3; // screenshots shown in the main README

// No near-duplicates: one entry per commit, and each entry should show a
// different scene or feature from the ones before it (pick the shot accordingly).
//   --rebuild   only refresh the README section from docs/devlog/README.md
const args = process.argv.slice(2);
const rebuild = args[0] === '--rebuild';
const [image, title] = args;
if (!rebuild && (!image || !title)) {
    console.error('usage: node scripts/devlog-add.mjs <screenshot> "<title>"   |   --rebuild');
    process.exit(1);
}

const git = cmd => execSync(`git ${cmd}`, { cwd: ROOT, encoding: 'utf8' }).trim();
const sha = git('rev-parse --short HEAD');
const date = git('log -1 --format=%ad --date=format:"%Y-%m-%d %H:%M"');
const repo = git('remote get-url origin').replace(/\.git$/, '');

if (!rebuild) {
if (readFileSync(LOG, 'utf8').includes(`/commit/${sha})`)) {
    console.error(`dev log: commit ${sha} already has an entry — nothing added`);
    process.exit(0);
}
const next = Math.max(0, ...readdirSync(LOG_DIR).map(f => parseInt(f, 10)).filter(Number.isFinite)) + 1;
const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
const file = `${String(next).padStart(2, '0')}-${slug}${extname(image) || '.jpg'}`;
copyFileSync(resolve(image), resolve(LOG_DIR, file));

// --- docs/devlog/README.md: newest first ---------------------------------
const entry = `## ${title}\n\n[\`${sha}\`](${repo}/commit/${sha}) · ${date}\n\n![${title}](${file})\n`;
const log = readFileSync(LOG, 'utf8');
const firstEntry = log.indexOf('\n## ');
writeFileSync(LOG, firstEntry < 0 ? `${log.trimEnd()}\n\n${entry}` : `${log.slice(0, firstEntry + 1)}${entry}\n${log.slice(firstEntry + 1)}`);

}

// --- main README: "Dev log" section with the newest screenshots ------------
const entries = [...readFileSync(LOG, 'utf8').matchAll(/^## (.+)\n\n\[`([0-9a-f]+)`\]\((\S+)\) · ([^\n]+)\n\n((?:!\[[^\]]*\]\([^)]+\)\n\n?)+)/gm)]
    .map(m => ({ title: m[1], sha: m[2], url: m[3], date: m[4], image: /\]\(([^)]+)\)/.exec(m[5])[1] }))
    .slice(0, SHOWN);
const section = [
    '## Dev log',
    '',
    ...entries.flatMap(e => [`**${e.title}** — [\`${e.sha}\`](${e.url}) · ${e.date}`, '', `![${e.title}](docs/devlog/${e.image})`, '']),
    '[All dev log entries →](docs/devlog/README.md)',
    ''
].join('\n');

let readme = readFileSync(README, 'utf8');
const START = '<!-- devlog:start -->', END = '<!-- devlog:end -->';
const block = `${START}\n${section}${END}`;
if (readme.includes(START)) {
    readme = readme.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
} else {
    // Second section: right after the play links line.
    readme = readme.replace(/(\*\*▶ Play:\*\*[^\n]*\n)/, `$1\n${block}\n`);
}
writeFileSync(README, readme);
console.log(rebuild ? 'dev log: README section rebuilt' : `dev log: entry added for ${sha}`);
