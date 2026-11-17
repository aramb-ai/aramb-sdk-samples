'use client';

import { useEffect, useState } from 'react';
import { ErrorNotice } from './ErrorNotice';
import type { ClientError } from '@/lib/errors';

type Status = 'active' | 'deleting' | 'deleted' | 'gone';

const POLL_MS = 5000;

async function call(method: 'GET' | 'DELETE', subTenant: string): Promise<Status> {
  const res = await fetch(`/api/admin/people/${encodeURIComponent(subTenant)}`, { method });
  // Once removed, the person may no longer be visible as a member of the company.
  if (res.status === 404) return 'gone';
  const body = (await res.json()) as { status?: Status; error?: ClientError };
  if (!res.ok || !body.status) {
    throw body.error ?? { code: `http_${res.status}`, message: `Request failed (${res.status}).` };
  }
  return body.status;
}

/** Remove button; while the removal runs it shows `deleting` and polls until `deleted`. */
export function RemovePerson({ subTenant, initialStatus }: { subTenant: string; initialStatus: Status }) {
  const [status, setStatus] = useState<Status>(initialStatus);
  const [error, setError] = useState<ClientError | null>(null);

  useEffect(() => {
    if (status !== 'deleting') return;
    const timer = setTimeout(() => {
      call('GET', subTenant).then(setStatus, (err: ClientError) => setError(err));
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [status, subTenant]);

  const remove = () => {
    if (!window.confirm('Remove this person and all their conversations?')) return;
    setError(null);
    call('DELETE', subTenant).then(setStatus, (err: ClientError) => setError(err));
  };

  return (
    <>
      {status === 'active' ? (
        <button type="button" onClick={remove}>
          Remove person
        </button>
      ) : (
        <p>
          Status: <strong>{status === 'gone' ? 'removed (no longer listed in your company)' : status}</strong>
        </p>
      )}
      {error ? <ErrorNotice error={error} /> : null}
    </>
  );
}
