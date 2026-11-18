import type { ClientError } from '@/lib/errors';

/** One failure, shown the same way everywhere: the message, and the request id to quote when asking for help. */
export function ErrorNotice({ error }: { error: ClientError }) {
  return (
    <div className="error" role="alert">
      <div>{error.message}</div>
      {error.requestId ? <div className="muted">Request id: {error.requestId}</div> : null}
    </div>
  );
}
