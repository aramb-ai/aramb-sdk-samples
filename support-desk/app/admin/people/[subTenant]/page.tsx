import Link from 'next/link';
import { ErrorNotice } from '@/components/ErrorNotice';
import { RemovePerson } from '@/components/RemovePerson';
import { conversationsOf, personInGroup } from '@/lib/admin';
import { loadAdmin } from '@/lib/admin-page';
import { requireViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

export default async function PersonPage({ params }: { params: Promise<{ subTenant: string }> }) {
  const viewer = await requireViewer();
  const { subTenant } = await params;
  const result = await loadAdmin(viewer, async (client, groupId) => {
    const person = await personInGroup(client, groupId, decodeURIComponent(subTenant));
    return { person, conversations: await conversationsOf(client, person.subTenant) };
  });
  return (
    <>
      <p>
        <Link href="/admin">← Dashboard</Link>
      </p>
      {'error' in result ? (
        <ErrorNotice error={result.error} />
      ) : (
        <>
          <h1>{result.data.person.displayName ?? result.data.person.subTenant}</h1>
          <h2>Conversations</h2>
          {result.data.conversations.length === 0 ? (
            <p className="muted">No conversations.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Agent</th>
                  <th>Last message</th>
                </tr>
              </thead>
              <tbody>
                {result.data.conversations.map((c) => (
                  <tr key={c.id}>
                    <td>{c.title || '(untitled)'}</td>
                    <td>{c.agentId}</td>
                    <td>{c.lastMessageAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <h2>Remove</h2>
          <p className="muted">Removes this person and their conversations. Their credits history stays.</p>
          <RemovePerson subTenant={result.data.person.subTenant} initialStatus={result.data.person.status} />
        </>
      )}
    </>
  );
}
