import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { aramb } from './aramb';
import { devLoginEnabled } from './env';
import { toClientError } from './errors';
import { normalizeEmail, subTenantFor } from './identity';
import { upsertPerson } from './people';

declare module 'next-auth' {
  interface Session {
    subTenant: string;
  }
}

export const DEV_LOGIN_PROVIDER = 'dev-login';

const providers: NextAuthConfig['providers'] = [];
const providerIds: string[] = [];
if (process.env.AUTH_GOOGLE_ID) {
  providers.push(Google);
  providerIds.push('google');
}
if (devLoginEnabled(process.env)) {
  providerIds.push(DEV_LOGIN_PROVIDER);
  providers.push(
    Credentials({
      id: DEV_LOGIN_PROVIDER,
      name: 'Dev login',
      credentials: { email: { label: 'Email', type: 'email' } },
      authorize(credentials) {
        const email = typeof credentials?.email === 'string' ? normalizeEmail(credentials.email) : '';
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
        return { id: subTenantFor('dev', email), email };
      },
    }),
  );
}

/** Ids of the providers this server offers (for the sign-in page). */
export const enabledProviders: ReadonlySet<string> = new Set(providerIds);

/** The aramb end-user for a completed login, or `null` when the login doesn't identify one. */
function subTenantOf(provider: string, profileSub: unknown, userId: string | undefined): string | null {
  if (provider === 'google' && typeof profileSub === 'string') return subTenantFor('google', profileSub);
  if (provider === DEV_LOGIN_PROVIDER && userId) return userId;
  return null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: 'jwt' },
  pages: { signIn: '/signin', error: '/signin' },
  callbacks: {
    async signIn({ account, profile, user }) {
      if (!account || !user.email) return '/signin?error=bad_request';
      if (account.provider === 'google' && profile?.email_verified !== true) return '/signin?error=unverified_email';
      const subTenant = subTenantOf(account.provider, profile?.sub, user.id);
      if (!subTenant) return '/signin?error=bad_request';
      try {
        await upsertPerson(aramb(), subTenant, user.email);
        return true;
      } catch (err) {
        const e = toClientError(err, 'sign-in');
        const q = new URLSearchParams({ error: e.code });
        if (e.requestId) q.set('requestId', e.requestId);
        return `/signin?${q.toString()}`;
      }
    },
    jwt({ token, account, profile, user }) {
      if (account) {
        const subTenant = subTenantOf(account.provider, profile?.sub, user?.id);
        if (!subTenant) throw new Error(`Login via ${account.provider} did not identify a person.`);
        token.subTenant = subTenant;
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token.subTenant !== 'string') throw new Error('Session token has no subTenant.');
      session.subTenant = token.subTenant;
      return session;
    },
  },
});
