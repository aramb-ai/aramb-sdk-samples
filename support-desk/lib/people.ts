import { isArambError, type Aramb, type EndUser, type Group } from '@aramb-ai/sdk';
import { companyOf } from './identity';

type GroupsClient = Pick<Aramb, 'groups'>;
type PeopleClient = Pick<Aramb, 'endUsers' | 'groups'>;

/**
 * The company group of an email domain: the group whose `externalRef` is the
 * domain (its `name` is the domain too). The SDK has no lookup by name or
 * externalRef, so this pages through `groups.list` — one call per 100-ish
 * groups on every sign-in (see the README).
 */
export async function findCompanyGroup(client: GroupsClient, domain: string): Promise<Group | null> {
  let cursor: string | undefined;
  do {
    const page = await client.groups.list({ cursor });
    const hit = page.groups.find((g) => g.externalRef === domain);
    if (hit) return hit;
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return null;
}

/** Find the company group of `domain`, or create it. A concurrent create (`conflict`) is resolved by reading again. */
export async function findOrCreateCompanyGroup(client: GroupsClient, domain: string): Promise<Group> {
  const existing = await findCompanyGroup(client, domain);
  if (existing) return existing;
  try {
    return await client.groups.create({ name: domain, externalRef: domain });
  } catch (err) {
    if (isArambError(err) && err.code === 'conflict') {
      const created = await findCompanyGroup(client, domain);
      if (created) return created;
    }
    throw err;
  }
}

/**
 * Called on every sign-in: make sure the person exists in aramb and is in the
 * group of their email domain (no group for a public mail domain). Throws the
 * SDK error as is — `conflict` means the person is being removed.
 */
export async function upsertPerson(client: PeopleClient, subTenant: string, email: string): Promise<EndUser> {
  const company = companyOf(email);
  const groupId = company ? (await findOrCreateCompanyGroup(client, company)).id : null;
  return client.endUsers.upsert(subTenant, { displayName: email, groupId });
}
