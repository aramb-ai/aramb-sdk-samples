import 'server-only';
import { redirect } from 'next/navigation';
import type { Viewer } from './admin';
import { auth } from './auth';

/** The signed-in person, or `null`. */
export async function currentViewer(): Promise<Viewer | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!session || !email || !session.subTenant) return null;
  return { email, subTenant: session.subTenant };
}

/** The signed-in person; sends anyone else to the sign-in page. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await currentViewer();
  if (!viewer) redirect('/signin');
  return viewer;
}
