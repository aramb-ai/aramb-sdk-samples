// R2, at runtime: start the built app with a throwaway key and check that no
// server-rendered page or API response (body or headers) contains the key or
// the name of the variable that holds it. Run after `npm run build`.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const port = 3199;
const base = `http://127.0.0.1:${port}`;
// Built at runtime so no key-shaped string is ever committed.
const key = ['aramb', 'sk', randomBytes(12).toString('hex')].join('_');
const NEEDLES = [key, 'ARAMB_KEY'];
const PATHS = [
  ['GET', '/'],
  ['GET', '/signin'],
  ['GET', '/chat/support'],
  ['GET', '/admin'],
  ['GET', '/api/agents/support'],
  ['POST', '/api/chat/support'],
  ['GET', '/api/conversations/x?agent=support'],
  ['GET', '/api/admin/people/u_x'],
  ['GET', '/api/auth/providers'],
  ['GET', '/api/auth/session'],
  ['GET', '/api/auth/csrf'],
  ['GET', '/does-not-exist'],
];

const server = spawn(path.join(root, 'node_modules', '.bin', 'next'), ['start', '-p', String(port)], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    ALLOW_DEV_LOGIN: '0',
    ARAMB_KEY: key,
    // Unreachable on purpose: SDK calls fail, and their error responses are scanned too.
    ARAMB_BASE_URL: 'http://127.0.0.1:9',
    AUTH_SECRET: randomBytes(32).toString('hex'),
    AUTH_TRUST_HOST: 'true',
    SUPPORT_AGENT_ID: 'agent-support',
    BILLING_AGENT_ID: 'agent-billing',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

async function waitUp() {
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(`${base}/api/auth/csrf`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error(`next start did not answer on ${base}`);
}

const hits = [];
try {
  await waitUp();
  for (const [method, p] of PATHS) {
    const res = await fetch(base + p, {
      method,
      redirect: 'manual',
      headers: { 'content-type': 'application/json' },
      body: method === 'POST' ? JSON.stringify({ message: 'hi' }) : undefined,
    });
    const text = `${[...res.headers].map(([k, v]) => `${k}: ${v}`).join('\n')}\n${await res.text()}`;
    for (const needle of NEEDLES) if (text.includes(needle)) hits.push(`${method} ${p}: ${needle === key ? 'the key' : needle}`);
    console.log(`scan-responses: ${method} ${p} -> ${res.status}`);
    // A 5xx means the handler didn't run as intended, so its response proves nothing.
    if (res.status >= 500) hits.push(`${method} ${p}: unexpected status ${res.status}`);
  }
} catch (err) {
  console.error('scan-responses: failed:', err, '\n--- server output ---\n', serverLog);
  server.kill();
  process.exit(1);
}
server.kill();
if (hits.length > 0) {
  console.error(`scan-responses: failed:\n${hits.join('\n')}\n--- server output ---\n${serverLog}`);
  process.exit(1);
}
console.log(`scan-responses: ${PATHS.length} responses, no key or key variable name.`);
