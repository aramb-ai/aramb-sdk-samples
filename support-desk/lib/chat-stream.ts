import type { Aramb } from '@aramb-ai/sdk';
import { toClientError } from './errors';

type ChatClient = Pick<Aramb, 'session'>;

export interface ChatTurn {
  agentId: string;
  subTenant: string;
  subTenantDisplay: string;
  message: string;
  /** Resume this conversation; omitted → a new one is started. */
  conversationId?: string;
}

/** Encode one Server-Sent Event. */
export function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Run one chat turn on a Session that lives only for this request, and relay
 * it to the browser as SSE:
 *
 * - `conversation` `{ id }` — the conversation this turn belongs to (keep it to resume);
 * - `chunk` `{ delta }` — reply text as it streams;
 * - `error` `{ code, message, requestId? }` — the turn failed (chunks already sent stay valid);
 * - `done` `{}` — the turn finished.
 *
 * When the browser goes away (`signal` aborts, or the stream is cancelled) the
 * Session is closed and nothing more is written. The Session is always closed
 * at the end.
 */
export function chatStream(client: ChatClient, turn: ChatTurn, signal: AbortSignal): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const session = client.session({
    agentId: turn.agentId,
    subTenant: turn.subTenant,
    subTenantDisplay: turn.subTenantDisplay,
    ...(turn.conversationId ? { conversationId: turn.conversationId } : { newConversation: true }),
  });
  // `live`: the browser is still there and the Session still runs.
  // `cancelled`: the response stream was cancelled, so it must not be closed again.
  let live = true;
  let cancelled = false;

  const stop = (): void => {
    if (!live) return;
    live = false;
    session.close().catch((err: unknown) => console.error('[chat] closing session failed', err));
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown): void => {
        if (live) controller.enqueue(encoder.encode(sseEvent(event, data)));
      };
      if (signal.aborted) {
        stop();
        controller.close();
        return;
      }
      signal.addEventListener('abort', stop, { once: true });
      session.on('conversationCreated', (id) => send('conversation', { id }));
      if (turn.conversationId) send('conversation', { id: turn.conversationId });

      try {
        for await (const chunk of session.stream(turn.message)) {
          if (!live) break;
          send('chunk', { delta: chunk.delta });
        }
        send('done', {});
      } catch (err) {
        // After the browser left, the stream ends with `session_closed`: nobody to tell.
        if (live) send('error', toClientError(err, 'chat'));
      } finally {
        signal.removeEventListener('abort', stop);
        stop();
        if (!cancelled) controller.close();
      }
    },
    cancel() {
      cancelled = true;
      stop();
    },
  });
}
