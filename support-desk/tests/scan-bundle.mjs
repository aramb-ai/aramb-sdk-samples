// R2: the builder key never reaches the browser. After `next build`, fail if
// any file served to the browser (.next/static) mentions a builder key prefix
// or the name of the variable that holds it.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '.next', 'static');
const NEEDLES = ['aramb_sk_', 'ARAMB_KEY'];

if (!fs.existsSync(root)) {
  console.error(`scan-bundle: ${root} does not exist; run "npm run build" first.`);
  process.exit(1);
}

const hits = [];
let files = 0;
for (const entry of fs.readdirSync(root, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue;
  files += 1;
  const file = path.join(entry.parentPath, entry.name);
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of NEEDLES) if (text.includes(needle)) hits.push(`${path.relative(root, file)}: ${needle}`);
}

if (files === 0) {
  console.error('scan-bundle: .next/static is empty; the build did not produce a client bundle.');
  process.exit(1);
}
if (hits.length > 0) {
  console.error(`scan-bundle: found in the client bundle:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`scan-bundle: ${files} client files, no builder key or key variable name.`);
