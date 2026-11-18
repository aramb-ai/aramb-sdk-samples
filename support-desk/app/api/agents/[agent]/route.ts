import { NextResponse } from 'next/server';
import { aramb } from '@/lib/aramb';
import { AGENTS, agentIdFor, isAgentKey } from '@/lib/agents';
import { errorResponse, failure, notFound, unauthenticated } from '@/lib/http';
import { messageFor } from '@/lib/errors';
import { currentViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

/** GET → `{ label, greeting, starters }` of one agent, from its published version (what people chat with). */
export async function GET(_request: Request, ctx: { params: Promise<{ agent: string }> }) {
  if (!(await currentViewer())) return unauthenticated();
  const { agent } = await ctx.params;
  if (!isAgentKey(agent)) return notFound();
  try {
    const client = aramb();
    const agentId = agentIdFor(agent);
    const { publishedVersion } = await client.getAgent(agentId);
    if (publishedVersion === 0) {
      return errorResponse({ code: 'agent_not_published', message: messageFor('agent_not_published') }, 409);
    }
    const { config } = await client.getAgentVersion(agentId, publishedVersion);
    return NextResponse.json({
      label: AGENTS[agent].label,
      greeting: config.greeting ?? '',
      starters: config.conversationStarters ?? [],
    });
  } catch (err) {
    return failure(err, 'agent');
  }
}
