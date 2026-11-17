/**
 * `npm run setup`: create and publish the desk's two agents through the SDK,
 * and write their ids to `.env.local` (ignored by git). Re-running keeps
 * agents that already exist and only creates the missing ones.
 */
import fs from 'node:fs';
import path from 'node:path';
import nextEnv from '@next/env';
import { Aramb, isArambError, type CreateAgentParams } from '@aramb-ai/sdk';
import { AGENTS, type AgentKey } from '../lib/agents';
import { requireEnv } from '../lib/env';

const root = path.resolve(import.meta.dirname, '..');
nextEnv.loadEnvConfig(root);
const envFile = path.join(root, '.env.local');

const SPECS: Record<AgentKey, CreateAgentParams> = {
  support: {
    name: 'Support desk: Support',
    systemPrompt:
      'You are the support agent of a small software company. Help people use the product: ' +
      'ask what they were trying to do, explain the steps clearly, and say so when something needs a human.',
    greeting: 'Hi! I am the support agent. What can I help you with?',
    conversationStarters: ['I cannot sign in', 'How do I invite a colleague?'],
  },
  billing: {
    name: 'Support desk: Billing',
    systemPrompt:
      'You are the billing agent of a small software company. Answer questions about plans, invoices ' +
      'and payments in plain words. You cannot see or change real accounts; say so when asked to.',
    greeting: 'Hi! I am the billing agent. Ask me about plans, invoices or payments.',
    conversationStarters: ['Which plan fits a team of five?', 'How do I get an invoice?'],
  },
};

/** Set `name=value` in .env.local, keeping every other line. */
function writeEnv(name: string, value: string): void {
  const lines = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8').split('\n') : [];
  const at = lines.findIndex((l) => l.startsWith(`${name}=`));
  if (at >= 0) lines[at] = `${name}=${value}`;
  else lines.splice(lines.at(-1) === '' ? lines.length - 1 : lines.length, 0, `${name}=${value}`);
  fs.writeFileSync(envFile, lines.join('\n').replace(/\n*$/, '\n'));
}

/** `true` when `agentId` exists for this key and has a published version. */
async function isUsable(client: Aramb, agentId: string): Promise<boolean> {
  try {
    return (await client.getAgent(agentId)).publishedVersion > 0;
  } catch (err) {
    if (isArambError(err) && err.code === 'not_found') return false;
    throw err;
  }
}

async function main(): Promise<void> {
  const client = new Aramb({
    apiKey: requireEnv(process.env, 'ARAMB_KEY'),
    baseUrl: process.env.ARAMB_BASE_URL || undefined,
  });
  for (const key of Object.keys(AGENTS) as AgentKey[]) {
    const { envVar, label } = AGENTS[key];
    const existing = process.env[envVar];
    if (existing && (await isUsable(client, existing))) {
      console.log(`${label}: keeping ${existing}`);
      continue;
    }
    const created = await client.createAgent({ ...SPECS[key], publish: true });
    writeEnv(envVar, created.agentId);
    console.log(`${label}: created and published ${created.agentId}`);
  }
  console.log(`Agent ids are in ${path.relative(process.cwd(), envFile) || '.env.local'}. Next: npm run dev`);
}

main().catch((err: unknown) => {
  if (isArambError(err)) {
    console.error(`Setup failed: ${err.code}: ${err.message}${err.requestId ? ` (request id ${err.requestId})` : ''}`);
  } else {
    console.error('Setup failed:', err);
  }
  process.exit(1);
});
