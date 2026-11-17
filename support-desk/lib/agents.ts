import { requireEnv } from './env';

/** The two agents of the desk. Their ids are written to `.env.local` by `npm run setup`. */
export const AGENTS = {
  support: { label: 'Support', envVar: 'SUPPORT_AGENT_ID' },
  billing: { label: 'Billing', envVar: 'BILLING_AGENT_ID' },
} as const;

export type AgentKey = keyof typeof AGENTS;

export function isAgentKey(value: string): value is AgentKey {
  return Object.hasOwn(AGENTS, value);
}

export function agentIdFor(key: AgentKey, env: Readonly<Record<string, string | undefined>> = process.env): string {
  return requireEnv(env, AGENTS[key].envVar);
}
