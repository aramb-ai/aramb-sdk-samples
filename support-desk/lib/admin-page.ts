import 'server-only';
import { notFound } from 'next/navigation';
import { NotAdminError, NotInCompanyError, adminGroupId, type Viewer } from './admin';
import { aramb } from './aramb';
import { toClientError, type ClientError } from './errors';

/**
 * Run an admin page's SDK reads. A person outside the company → 404 page; not
 * an admin or an SDK failure → a {@link ClientError} to render.
 */
export async function loadAdmin<T>(
  viewer: Viewer,
  load: (client: ReturnType<typeof aramb>, groupId: string) => Promise<T>,
): Promise<{ data: T } | { error: ClientError }> {
  try {
    const client = aramb();
    const groupId = await adminGroupId(client, viewer, process.env.ADMIN_EMAILS);
    return { data: await load(client, groupId) };
  } catch (err) {
    if (err instanceof NotAdminError) return { error: { code: 'forbidden', message: err.message } };
    if (err instanceof NotInCompanyError) notFound();
    return { error: toClientError(err, 'admin') };
  }
}
