/**
 * Public mail domains. A person on one of these gets no company (no group) and
 * can never be an admin: two strangers on gmail.com are not colleagues.
 */
export const PUBLIC_DOMAINS: ReadonlySet<string> = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'yahoo.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
]);

export function isPublicDomain(domain: string): boolean {
  return PUBLIC_DOMAINS.has(domain.toLowerCase());
}
