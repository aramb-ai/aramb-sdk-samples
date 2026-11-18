import { EventEmitter } from 'node:events';
import { ArambError, type Aramb, type SessionParams } from '@aramb-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { chatStream } from '../lib/chat-stream';
import { readSse, type SseMessage } from '../lib/sse-client';

/** A stand-in for the SDK Session: emits `conversationCreated`, yields chunks, may fail or wait. */
class FakeSession extends EventEmitter {
  closed = false;
  input = '';
  constructor(private readonly script: (s: FakeSession) => AsyncGenerator<{ delta: string }>) {
    super();
  }
  stream(input: string) {
    this.input = input;
    return this.script(this);
  }
  async close() {
    this.closed = true;
    this.emit('closed');
  }
}

function client(session: FakeSession) {
  const params: SessionParams[] = [];
  const fake = {
    session: (p: SessionParams) => {
      params.push(p);
      return session;
    },
  } as unknown as Pick<Aramb, 'session'>;
  return { fake, params };
}

const turn = { agentId: 'agent-1', subTenant: 'u_d_abc', subTenantDisplay: 'ada@acme.test', message: 'hello' };

async function collect(stream: ReadableStream<Uint8Array>): Promise<SseMessage[]> {
  const out: SseMessage[] = [];
  for await (const m of readSse(stream)) out.push(m);
  return out;
}

describe('chatStream', () => {
  it('relays the new conversation id, the chunks, then done, and closes the session', async () => {
    const session = new FakeSession(async function* (s) {
      s.emit('conversationCreated', 'conv-1');
      yield { delta: 'Hel' };
      yield { delta: 'lo' };
    });
    const { fake, params } = client(session);
    const events = await collect(chatStream(fake, turn, new AbortController().signal));
    expect(events).toEqual([
      { event: 'conversation', data: { id: 'conv-1' } },
      { event: 'chunk', data: { delta: 'Hel' } },
      { event: 'chunk', data: { delta: 'lo' } },
      { event: 'done', data: {} },
    ]);
    expect(params[0]).toEqual({
      agentId: 'agent-1',
      subTenant: 'u_d_abc',
      subTenantDisplay: 'ada@acme.test',
      newConversation: true,
    });
    expect(session.input).toBe('hello');
    expect(session.closed).toBe(true);
  });

  it('resumes a given conversation and announces it up front', async () => {
    const session = new FakeSession(async function* () {
      yield { delta: 'ok' };
    });
    const { fake, params } = client(session);
    const events = await collect(chatStream(fake, { ...turn, conversationId: 'conv-9' }, new AbortController().signal));
    expect(params[0]).toMatchObject({ conversationId: 'conv-9' });
    expect(params[0]).not.toHaveProperty('newConversation');
    expect(events[0]).toEqual({ event: 'conversation', data: { id: 'conv-9' } });
  });

  it('sends an error event after the chunks already sent when the SDK stream fails mid-reply', async () => {
    const session = new FakeSession(async function* () {
      yield { delta: 'partial' };
      throw new ArambError('out_of_credits', 'raw', { requestId: 'req-7' });
    });
    const { fake } = client(session);
    const events = await collect(chatStream(fake, turn, new AbortController().signal));
    expect(events).toEqual([
      { event: 'chunk', data: { delta: 'partial' } },
      {
        event: 'error',
        data: {
          code: 'out_of_credits',
          message: 'This service is out of credits. Please contact the company admin.',
          requestId: 'req-7',
        },
      },
    ]);
    expect(session.closed).toBe(true);
  });

  it('closes the session and stops relaying when the browser disconnects', async () => {
    const session = new FakeSession(async function* (s) {
      yield { delta: 'first' };
      // Wait until closed, then end the way the SDK does: session_closed.
      await new Promise((resolve) => s.once('closed', resolve));
      throw new ArambError('session_closed', 'Session was closed.');
    });
    const { fake } = client(session);
    const abort = new AbortController();
    const reader = readSse(chatStream(fake, turn, abort.signal));
    expect((await reader.next()).value).toEqual({ event: 'chunk', data: { delta: 'first' } });
    abort.abort();
    expect(await reader.next()).toEqual({ value: undefined, done: true });
    expect(session.closed).toBe(true);
  });

  it('closes the session when the response stream is cancelled', async () => {
    const session = new FakeSession(async function* (s) {
      yield { delta: 'first' };
      await new Promise((resolve) => s.once('closed', resolve));
      throw new ArambError('session_closed', 'Session was closed.');
    });
    const { fake } = client(session);
    const stream = chatStream(fake, turn, new AbortController().signal);
    const reader = stream.getReader();
    await reader.read();
    await reader.cancel();
    await vi.waitFor(() => expect(session.closed).toBe(true));
  });

  it('does not stream at all when the request was already aborted', async () => {
    const script = vi.fn(async function* () {
      yield { delta: 'never' };
    });
    const session = new FakeSession(script);
    const { fake } = client(session);
    const abort = new AbortController();
    abort.abort();
    expect(await collect(chatStream(fake, turn, abort.signal))).toEqual([]);
    expect(script).not.toHaveBeenCalled();
    expect(session.closed).toBe(true);
  });
});
