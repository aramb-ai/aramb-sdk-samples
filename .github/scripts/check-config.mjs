// H5: configuration by template only.
// - <sample>/.env.example values are empty or a known public placeholder;
// - every "resolved" URL in every tracked package-lock.json is on the public
//   npm registry (a lockfile made against another registry would leak its host);
// - every installed package in a lockfile has a "resolved" URL and an
//   "integrity" hash (only the root and workspace links are exempt).
// Prints only file:line. Exit 1 on any finding.
import fs from 'node:fs';
import { samples, trackedFiles } from './lib.mjs';

const PLACEHOLDERS = new Set(['', 'https://api.aramb.ai/gw', '0']);
const REGISTRY = 'https://registry.npmjs.org/';

const files = trackedFiles();
const bad = [];

for (const sample of samples(files)) {
  const file = `${sample}/.env.example`;
  if (!files.includes(file)) continue;
  fs.readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const t = line.trim();
      if (t === '' || t.startsWith('#')) return;
      const eq = t.indexOf('=');
      if (eq === -1) return bad.push(`${file}:${i + 1} (not NAME=value)`);
      if (!PLACEHOLDERS.has(t.slice(eq + 1).trim())) bad.push(`${file}:${i + 1} (value is not empty or a placeholder)`);
    });
}

for (const file of files.filter((f) => f === 'package-lock.json' || f.endsWith('/package-lock.json'))) {
  fs.readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const m = /"resolved":\s*"([^"]*)"/.exec(line);
      if (m && !m[1].startsWith(REGISTRY)) bad.push(`${file}:${i + 1} (resolved outside ${REGISTRY})`);
    });
}

for (const file of files.filter((f) => f === 'package-lock.json' || f.endsWith('/package-lock.json'))) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const { packages = {} } = JSON.parse(lines.join('\n'));
  for (const [key, entry] of Object.entries(packages)) {
    if (key === '' || entry.link === true) continue;
    if (entry.resolved && entry.integrity) continue;
    const at = lines.findIndex((l) => l.trim() === `${JSON.stringify(key)}: {`);
    bad.push(`${file}:${at + 1} (no ${entry.resolved ? 'integrity' : 'resolved'})`);
  }
}

if (bad.length > 0) {
  console.error(`H5: ${bad.length} finding(s):\n${bad.join('\n')}`);
  process.exit(1);
}
console.log('H5: .env.example files hold only placeholders; every lockfile entry resolves from the public npm registry with an integrity hash.');
