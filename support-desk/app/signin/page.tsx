import { redirect } from 'next/navigation';
import { ErrorNotice } from '@/components/ErrorNotice';
import { DEV_LOGIN_PROVIDER, enabledProviders, signIn } from '@/lib/auth';
import { messageFor } from '@/lib/errors';
import { currentViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

type Search = Promise<{ error?: string; requestId?: string }>;

export default async function SignIn({ searchParams }: { searchParams: Search }) {
  if (await currentViewer()) redirect('/');
  const { error, requestId } = await searchParams;
  const google = enabledProviders.has('google');
  const dev = enabledProviders.has(DEV_LOGIN_PROVIDER);
  return (
    <>
      <h1>Sign in</h1>
      {error ? <ErrorNotice error={{ code: error, message: signInMessage(error), requestId }} /> : null}
      {google ? (
        <form
          action={async () => {
            'use server';
            await signIn('google', { redirectTo: '/' });
          }}
        >
          <button type="submit">Sign in with Google</button>
        </form>
      ) : null}
      {dev ? (
        <form
          action={async (form: FormData) => {
            'use server';
            await signIn(DEV_LOGIN_PROVIDER, { email: String(form.get('email') ?? ''), redirectTo: '/' });
          }}
        >
          <p className="muted">Dev login (local only): any email, no password.</p>
          <div className="row">
            <input name="email" type="email" required placeholder="ada@acme.test" aria-label="Email" />
            <button type="submit">Sign in</button>
          </div>
        </form>
      ) : null}
      {!google && !dev ? (
        <p>No sign-in method is configured. Set AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET (see the README).</p>
      ) : null}
    </>
  );
}

/** Auth.js' own error codes (e.g. `CredentialsSignin`) get a plain sentence; app and SDK codes use the shared map. */
function signInMessage(code: string): string {
  if (code === 'CredentialsSignin') return 'Enter a valid email address.';
  return messageFor(code);
}
