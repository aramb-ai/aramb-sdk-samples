// Shared helpers for the hygiene scripts. Plain Node, no dependencies.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

/** Every tracked file, as git lists it (repo-relative, forward slashes). */
export function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
}

/** A top-level folder is a sample when it tracks a `.allowed-paths` file. */
export function samples(files) {
  return new Set(files.filter((f) => /^[^/]+\/\.allowed-paths$/.test(f)).map((f) => f.split('/')[0]));
}

/** Patterns of an allow-list file: one per line, `#` comments and blank lines ignored. */
export function readPatterns(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'));
}

/** Glob → RegExp: `**` any depth, `*` within one segment, `?` one char, `{a,b}` alternatives. */
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      re += '.*';
      i++;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '{') {
      const end = glob.indexOf('}', i);
      if (end === -1) throw new Error(`Unclosed { in pattern ${glob}`);
      re += `(?:${glob
        .slice(i + 1, end)
        .split(',')
        .map((alt) => alt.replace(/[.+^$()|[\]\\]/g, '\\$&'))
        .join('|')})`;
      i = end;
    } else re += c.replace(/[.+^$()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}
