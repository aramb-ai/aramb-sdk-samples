import { NextResponse } from 'next/server';
import { aramb } from '@/lib/aramb';
import { AGENTS, agentIdFor, isAgentKey } from '@/lib/agents';
import { failure, notFound, unauthenticated } from '@/lib/http';
import { currentViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

/** GET → `{ label, greeting, starters }` of one agent, from its config in aramb. */
export async function GET(_request: Request, ctx: { params: Promise<{ agent: string }> }) {
  if (!(await currentViewer())) return unauthenticated();
  const { agent } = await ctx.params;
  if (!isAgentKey(agent)) return notFound();
  try {
    const { draft } = await aramb().getAgent(agentIdFor(agent));
    return NextResponse.json({
      label: AGENTS[agent].label,
      greeting: draft.config.greeting ?? '',
      starters: draft.config.conversationStarters ?? [],
    });
  } catch (err) {
    return failure(err, 'agent');
  }
}
