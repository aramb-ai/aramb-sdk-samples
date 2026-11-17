import { aramb } from '@/lib/aramb';
import { agentIdFor, isAgentKey } from '@/lib/agents';
import { chatStream } from '@/lib/chat-stream';
import { badRequest, failure, notFound, unauthenticated } from '@/lib/http';
import { currentViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

const MAX_MESSAGE_LENGTH = 8000;

/**
 * POST `{ message, conversationId? }` → an SSE stream of one chat turn (see
 * `lib/chat-stream.ts`). Each request opens its own short-lived Session, so this
 * works the same on one server, several, or serverless.
 */
export async function POST(request: Request, ctx: { params: Promise<{ agent: string }> }) {
  const viewer = await currentViewer();
  if (!viewer) return unauthenticated();
  const { agent } = await ctx.params;
  if (!isAgentKey(agent)) return notFound();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Body must be JSON.');
  }
  const { message, conversationId } = (body ?? {}) as { message?: unknown; conversationId?: unknown };
  if (typeof message !== 'string' || message.trim() === '' || message.length > MAX_MESSAGE_LENGTH) {
    return badRequest(`message must be 1-${MAX_MESSAGE_LENGTH} characters.`);
  }
  if (conversationId !== undefined && (typeof conversationId !== 'string' || conversationId === '')) {
    return badRequest('conversationId must be a non-empty string.');
  }

  try {
    const stream = chatStream(
      aramb(),
      {
        agentId: agentIdFor(agent),
        subTenant: viewer.subTenant,
        subTenantDisplay: viewer.email,
        message,
        conversationId,
      },
      request.signal,
    );
    return new Response(stream, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
      },
    });
  } catch (err) {
    return failure(err, 'chat');
  }
}
