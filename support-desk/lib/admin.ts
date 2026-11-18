import type { Aramb, Conversation, EndUser, UsageCreditsRow } from '@aramb-ai/sdk';
import { isArambError } from '@aramb-ai/sdk';
import { companyOf, isAdmin, parseAdminEmails } from './identity';
import { findCompanyGroup } from './people';
import type { MonthWindow } from './month';

type AdminClient = Pick<Aramb, 'endUsers' | 'groups' | 'getUsage' | 'listConversations'>;

/** The signed-in person as the admin pages see them. */
export interface Viewer {
  email: string;
  subTenant: string;
}

/** Thrown when the target is outside the admin's company, or doesn't exist. Rendered as a 404. */
export class NotInCompanyError extends Error {
  constructor() {
    super('Not found.');
    this.name = 'NotInCompanyError';
  }
}

/** Thrown when the viewer is not an admin. */
export class NotAdminError extends Error {
  constructor() {
    super('Only company admins can see this page.');
    this.name = 'NotAdminError';
  }
}

/**
 * The admin's company group id: the group of their email domain. Throws
 * {@link NotAdminError} when they are not an admin or their company has no
 * group yet.
 */
export async function adminGroupId(client: AdminClient, viewer: Viewer, adminEmailsRaw: string | undefined): Promise<string> {
  const domain = companyOf(viewer.email);
  if (!domain || !isAdmin(viewer.email, parseAdminEmails(adminEmailsRaw))) throw new NotAdminError();
  const group = await findCompanyGroup(client, domain);
  if (!group) throw new NotAdminError();
  return group.id;
}

/**
 * Read a person only if they are in `groupId`. Someone in another company and
 * someone who doesn't exist look the same: {@link NotInCompanyError}.
 */
export async function personInGroup(client: AdminClient, groupId: string, subTenant: string): Promise<EndUser> {
  let person: EndUser;
  try {
    person = await client.endUsers.get(subTenant);
  } catch (err) {
    if (isArambError(err) && err.code === 'not_found') throw new NotInCompanyError();
    throw err;
  }
  if (person.groupId !== groupId) throw new NotInCompanyError();
  return person;
}

/** One dashboard row: a person of the company and their credits in the window. */
export interface PersonUsage {
  subTenant: string;
  displayName: string;
  status: EndUser['status'];
  credits: number;
}

export interface CompanyUsage {
  window: MonthWindow;
  total: number;
  people: PersonUsage[];
  creditRateAsOf: string;
}

/**
 * Credits for the company and each of its people over `window`, straight from
 * `getUsage` (person rows grouped by end-user, the total grouped by group).
 * People with no usage show 0; deleted people with usage stay listed.
 */
export async function companyUsage(client: AdminClient, groupId: string, window: MonthWindow): Promise<CompanyUsage> {
  const range = { since: window.since, until: window.until };
  const [personRows, groupRows, members] = await Promise.all([
    allUsageRows(client, 'endUser', groupId, range),
    allUsageRows(client, 'group', groupId, range),
    allMembers(client, groupId),
  ]);

  const credits = new Map<string, number>();
  for (const row of personRows.rows) {
    if (row.key === null) continue;
    credits.set(row.key, (credits.get(row.key) ?? 0) + row.credits);
  }
  const people: PersonUsage[] = members.map((m) => ({
    subTenant: m.subTenant,
    displayName: m.displayName ?? m.subTenant,
    status: m.status,
    credits: credits.get(m.subTenant) ?? 0,
  }));
  const listed = new Set(people.map((p) => p.subTenant));
  for (const row of personRows.rows) {
    if (row.key === null || listed.has(row.key)) continue;
    listed.add(row.key);
    people.push({
      subTenant: row.key,
      displayName: row.key,
      status: row.deleted ? 'deleted' : 'active',
      credits: credits.get(row.key) ?? 0,
    });
  }
  people.sort((a, b) => b.credits - a.credits || a.displayName.localeCompare(b.displayName));

  const total = groupRows.rows.filter((r) => r.key === groupId).reduce((sum, r) => sum + r.credits, 0);
  return { window, total, people, creditRateAsOf: personRows.creditRateAsOf };
}

async function allUsageRows(
  client: AdminClient,
  groupBy: 'endUser' | 'group',
  groupId: string,
  range: { since: Date; until: Date },
): Promise<{ rows: UsageCreditsRow[]; creditRateAsOf: string }> {
  const rows: UsageCreditsRow[] = [];
  let cursor: string | undefined;
  let creditRateAsOf = '';
  do {
    const page = await client.getUsage({ groupBy, groupId, ...range, cursor });
    rows.push(...page.rows);
    creditRateAsOf = page.creditRateAsOf;
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return { rows, creditRateAsOf };
}

async function allMembers(client: AdminClient, groupId: string): Promise<EndUser[]> {
  const out: EndUser[] = [];
  let cursor: string | undefined;
  do {
    const page = await client.endUsers.list({ groupId, cursor });
    out.push(...page.endUsers);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return out;
}

/** All conversations of a person across both agents, newest first. */
export async function conversationsOf(client: AdminClient, subTenant: string): Promise<Conversation[]> {
  const out: Conversation[] = [];
  let cursor: string | undefined;
  do {
    const page = await client.listConversations({ subTenant, cursor });
    out.push(...page.conversations);
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  return out;
}
