import Link from 'next/link';
import { AGENTS } from '@/lib/agents';
import { signOut } from '@/lib/auth';
import { isAdmin, parseAdminEmails } from '@/lib/identity';
import { requireViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const viewer = await requireViewer();
  const admin = isAdmin(viewer.email, parseAdminEmails(process.env.ADMIN_EMAILS));
  return (
    <>
      <h1>Support desk</h1>
      <p className="muted">Signed in as {viewer.email}</p>
      <h2>Talk to</h2>
      <ul>
        {Object.entries(AGENTS).map(([key, agent]) => (
          <li key={key}>
            <Link href={`/chat/${key}`}>{agent.label}</Link>
          </li>
        ))}
      </ul>
      {admin ? (
        <p>
          <Link href="/admin">Company dashboard</Link>
        </p>
      ) : null}
      <form
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/signin' });
        }}
      >
        <button type="submit">Sign out</button>
      </form>
    </>
  );
}
