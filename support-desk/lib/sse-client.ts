/** One parsed Server-Sent Event. */
export interface SseMessage {
  event: string;
  data: unknown;
}

/**
 * Parse an SSE body (as written by `lib/chat-stream.ts`) into events. Works in
 * the browser and in Node. A `data` line that is not JSON is an error: the
 * server only ever writes JSON.
 */
export async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseMessage> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = 'message';
      const data: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7);
        else if (line.startsWith('data: ')) data.push(line.slice(6));
      }
      if (data.length > 0) yield { event, data: JSON.parse(data.join('\n')) };
    }
  }
}
