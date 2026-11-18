// H2: every tracked file must be allowed, and nothing on the global deny list
// may be tracked. Repo-level files are listed in .github/allowed-paths; files
// under <sample>/ in that sample's <sample>/.allowed-paths (relative to it).
// Prints only the offending paths. Exit 1 when there is any.
import { globToRegExp, readPatterns, samples, trackedFiles } from './lib.mjs';

/** Denied whatever any allow-list says. Returns the reason, or null. */
function denied(file, sampleSet) {
  const parts = file.split('/');
  const base = parts.at(-1);
  if (sampleSet.has(parts[0]) && parts[1] === '.github') return 'workflows/config inside a sample';
  for (const seg of parts) {
    if (seg.startsWith('.env') && !(seg === '.env.example' && seg === base)) return 'env file';
    if (seg === '.infra') return 'infra folder';
    if (seg === 'claude') return 'agent notes folder';
    if (seg === '.npmrc') return 'npm config';
  }
  if (/^CLAUDE\.md$/i.test(base) || /^AGENT.*\.md$/i.test(base)) return 'agent notes';
  if (/\.pem$/i.test(base)) return 'key file';
  if (/^docker-compose/i.test(base)) return 'compose file';
  return null;
}

const files = trackedFiles();
const sampleSet = samples(files);
const repoAllow = readPatterns('.github/allowed-paths').map(globToRegExp);
const sampleAllow = new Map([...sampleSet].map((s) => [s, readPatterns(`${s}/.allowed-paths`).map(globToRegExp)]));

const bad = [];
for (const file of files) {
  const reason = denied(file, sampleSet);
  if (reason) {
    bad.push(`${file}  (denied: ${reason})`);
    continue;
  }
  const top = file.split('/')[0];
  const allowed = sampleSet.has(top)
    ? sampleAllow.get(top).some((re) => re.test(file.slice(top.length + 1)))
    : repoAllow.some((re) => re.test(file));
  if (!allowed) bad.push(`${file}  (not in ${sampleSet.has(top) ? `${top}/.allowed-paths` : '.github/allowed-paths'})`);
}

if (bad.length > 0) {
  console.error(`H2: ${bad.length} file(s) not allowed in this public repository:\n${bad.join('\n')}`);
  process.exit(1);
}
console.log(`H2: ${files.length} tracked files, all allowed (${sampleSet.size} sample(s): ${[...sampleSet].join(', ')}).`);
