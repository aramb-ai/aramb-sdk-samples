import { NextResponse } from 'next/server';
import { aramb } from '@/lib/aramb';
import { agentIdFor, isAgentKey } from '@/lib/agents';
import { badRequest, failure, unauthenticated } from '@/lib/http';
import { currentViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

/**
 * GET `?agent=support` → the signed-in person's messages in one conversation.
 * The SDK call is scoped to the viewer's own subTenant, so someone else's
 * conversation id is `not_found`.
 */
export async function GET(request: Request, ctx: { params: Promise<{ conversationId: string }> }) {
  const viewer = await currentViewer();
  if (!viewer) return unauthenticated();
  const { conversationId } = await ctx.params;
  const agent = new URL(request.url).searchParams.get('agent') ?? '';
  if (!isAgentKey(agent)) return badRequest('agent must be support or billing.');
  try {
    const { messages, hasMore } = await aramb().getConversationMessages(conversationId, {
      agentId: agentIdFor(agent),
      subTenant: viewer.subTenant,
      limit: 200,
    });
    return NextResponse.json({ messages, hasMore });
  } catch (err) {
    return failure(err, 'history');
  }
}
