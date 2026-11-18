import { createHash } from 'node:crypto';
import { isPublicDomain } from './public-domains';

/**
 * One signed-in person is exactly one aramb end-user. The `subTenant` uses only
 * `[a-z0-9_]` (never `:`), so it can't collide with a channel prefix such as
 * `whatsapp:`.
 */
export type LoginKind = 'google' | 'dev';

/** `u_g_<google sub>` for Google, `u_d_<first 32 hex of sha256(lowercased email)>` for the dev login. */
export function subTenantFor(kind: LoginKind, id: string): string {
  if (kind === 'google') {
    // Google's `sub` is a decimal string; refuse anything else rather than
    // produce an id outside the charset.
    if (!/^[0-9]{1,64}$/.test(id)) throw new Error('Google account id must be digits only.');
    return `u_g_${id}`;
  }
  const email = normalizeEmail(id);
  return `u_d_${createHash('sha256').update(email).digest('hex').slice(0, 32)}`;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** The part after `@`, lowercased. Throws on a string that is not an address. */
export function domainOf(email: string): string {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf('@');
  if (at <= 0 || at === normalized.length - 1) throw new Error('Not an email address.');
  return normalized.slice(at + 1);
}

/** The company group name for an email, or `null` for a public mail domain. */
export function companyOf(email: string): string | null {
  const domain = domainOf(email);
  return isPublicDomain(domain) ? null : domain;
}

/** Comma-separated `ADMIN_EMAILS` → normalised set. */
export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map(normalizeEmail)
      .filter((e) => e.length > 0),
  );
}

/** An admin is listed in `ADMIN_EMAILS` and has a company (non-public) domain. */
export function isAdmin(email: string, adminEmails: ReadonlySet<string>): boolean {
  return adminEmails.has(normalizeEmail(email)) && companyOf(email) !== null;
}
