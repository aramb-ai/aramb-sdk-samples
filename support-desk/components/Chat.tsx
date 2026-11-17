'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ErrorNotice } from './ErrorNotice';
import type { ClientError } from '@/lib/errors';
import { readSse } from '@/lib/sse-client';

interface Line {
  role: 'user' | 'assistant';
  text: string;
}

interface AgentInfo {
  greeting: string;
  starters: string[];
}

/** Read `{ error }` from a failed JSON response, or describe the HTTP failure. */
async function errorOf(res: Response): Promise<ClientError> {
  try {
    const body = (await res.json()) as { error?: ClientError };
    if (body.error) return body.error;
  } catch {
    // Not JSON: fall through to the status line.
  }
  return { code: `http_${res.status}`, message: `Request failed (${res.status}). Please try again.` };
}

export function Chat({ agent, storageKey }: { agent: string; storageKey: string }) {
  const [info, setInfo] = useState<AgentInfo | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState<ClientError | null>(null);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');
  const conversationId = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  // Agent greeting + starters, then the stored conversation's history (if any).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/agents/${agent}`);
      if (!res.ok) throw await errorOf(res);
      const agentInfo = (await res.json()) as AgentInfo;
      if (cancelled) return;
      setInfo(agentInfo);

      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return;
      const hist = await fetch(`/api/conversations/${encodeURIComponent(stored)}?agent=${agent}`);
      if (hist.status === 404) {
        // Gone (e.g. the person was removed and signed in again): start fresh.
        window.localStorage.removeItem(storageKey);
        return;
      }
      if (!hist.ok) throw await errorOf(hist);
      const { messages } = (await hist.json()) as { messages: { role: string; content: string }[] };
      if (cancelled) return;
      conversationId.current = stored;
      setLines(
        messages
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .map((m) => ({ role: m.role as Line['role'], text: m.content })),
      );
    })().catch((err: unknown) => {
      if (!cancelled) setError(isClientError(err) ? err : { code: 'network', message: 'Could not load the chat. Please reload.' });
    });
    return () => {
      cancelled = true;
      abort.current?.abort();
    };
  }, [agent, storageKey]);

  const send = useCallback(
    async (text: string) => {
      setBusy(true);
      setError(null);
      setLines((prev) => [...prev, { role: 'user', text }, { role: 'assistant', text: '' }]);
      const controller = new AbortController();
      abort.current = controller;
      const appendDelta = (delta: string) =>
        setLines((prev) => {
          const next = prev.slice();
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, text: last.text + delta };
          return next;
        });
      try {
        const res = await fetch(`/api/chat/${agent}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: text, conversationId: conversationId.current ?? undefined }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw await errorOf(res);
        for await (const { event, data } of readSse(res.body)) {
          if (event === 'conversation') {
            const id = (data as { id: string }).id;
            conversationId.current = id;
            window.localStorage.setItem(storageKey, id);
          } else if (event === 'chunk') {
            appendDelta((data as { delta: string }).delta);
          } else if (event === 'error') {
            setError(data as ClientError);
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(isClientError(err) ? err : { code: 'network', message: 'The connection was lost. Reload to see the latest messages.' });
      } finally {
        setBusy(false);
      }
    },
    [agent, storageKey],
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    void send(text);
  };

  const newConversation = () => {
    conversationId.current = null;
    window.localStorage.removeItem(storageKey);
    setLines([]);
    setError(null);
  };

  return (
    <>
      <div className="messages">
        {info?.greeting && lines.length === 0 ? <div className="message">{info.greeting}</div> : null}
        {lines.map((line, i) => (
          <div key={i} className={`message ${line.role}`}>
            {line.text || (busy && i === lines.length - 1 ? '…' : '')}
          </div>
        ))}
      </div>
      {error ? <ErrorNotice error={error} /> : null}
      {info && lines.length === 0 && info.starters.length > 0 ? (
        <div className="row">
          {info.starters.map((s) => (
            <button key={s} type="button" disabled={busy} onClick={() => void send(s)}>
              {s}
            </button>
          ))}
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="row" style={{ marginTop: '1rem' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message"
          aria-label="Message"
          style={{ flex: 1 }}
        />
        <button type="submit" disabled={busy || input.trim() === ''}>
          Send
        </button>
        <button type="button" onClick={newConversation} disabled={busy}>
          New conversation
        </button>
      </form>
    </>
  );
}

function isClientError(value: unknown): value is ClientError {
  return typeof value === 'object' && value !== null && 'code' in value && 'message' in value;
}
