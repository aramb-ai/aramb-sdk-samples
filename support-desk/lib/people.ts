import { isArambError, type Aramb, type EndUser, type Group } from '@aramb-ai/sdk';
import { companyOf } from './identity';

type PeopleClient = Pick<Aramb, 'endUsers' | 'groups'>;

/** Find the group named `name`, or create it. A concurrent create (`conflict`) is resolved by reading again. */
export async function findOrCreateGroup(client: PeopleClient, name: string): Promise<Group> {
  const existing = await findGroup(client, name);
  if (existing) return existing;
  try {
    return await client.groups.create({ name });
  } catch (err) {
    if (isArambError(err) && err.code === 'conflict') {
      const created = await findGroup(client, name);
      if (created) return created;
    }
    throw err;
  }
}

async function findGroup(client: PeopleClient, name: string): Promise<Group | null> {
  let cursor: string | undefined;
  do {
    const page = await client.groups.list({ cursor });
    const hit = page.groups.find((g) => g.name === name);
    if (hit) return hit;
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return null;
}

/**
 * Called on every sign-in: make sure the person exists in aramb and is in the
 * group of their email domain (no group for a public mail domain). Throws the
 * SDK error as is — `conflict` means the person is being removed.
 */
export async function upsertPerson(client: PeopleClient, subTenant: string, email: string): Promise<EndUser> {
  const company = companyOf(email);
  const groupId = company ? (await findOrCreateGroup(client, company)).id : null;
  return client.endUsers.upsert(subTenant, { displayName: email, groupId });
}
