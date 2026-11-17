import { ArambError, type Aramb, type GetUsageParams } from '@aramb-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { NotAdminError, NotInCompanyError, adminGroupId, companyUsage, personInGroup } from '../lib/admin';
import { monthWindow } from '../lib/month';
import { person } from './fakes';

const ADMIN = { email: 'ada@acme.test', subTenant: 'u_ada' };

function fakeClient() {
  const people = new Map([
    ['u_ada', person('u_ada', 'g-acme')],
    ['u_bob', person('u_bob', 'g-acme')],
    ['u_eve', person('u_eve', 'g-globex', { displayName: 'eve@globex.test' })],
  ]);
  const endUsers = {
    get: vi.fn(async (s: string) => {
      const p = people.get(s);
      if (!p) throw new ArambError('not_found', 'no such person', { status: 404 });
      return p;
    }),
    list: vi.fn(async ({ groupId }: { groupId?: string }) => ({
      endUsers: [...people.values()].filter((p) => p.groupId === groupId),
      nextCursor: null,
    })),
    delete: vi.fn(),
  };
  const getUsage = vi.fn(async (p: GetUsageParams) => {
    const rows =
      p.groupBy === 'endUser'
        ? [
            { key: 'u_ada', endUserId: 'id-u_ada', deleted: false, credits: 3 },
            { key: 'u_bob', endUserId: 'id-u_bob-old', deleted: true, credits: 1.5 },
            { key: 'u_bob', endUserId: 'id-u_bob', deleted: false, credits: 2 },
            { key: 'u_gone', endUserId: 'id-u_gone', deleted: true, credits: 4 },
          ]
        : [{ key: 'g-acme', endUserId: null, deleted: false, credits: 10.5 }];
    return { since: '', until: '', products: [], rows, nextCursor: null, creditRateAsOf: '2026-11-17T00:00:00Z' };
  });
  const client = { endUsers, getUsage, listConversations: vi.fn() } as unknown as Pick<
    Aramb,
    'endUsers' | 'getUsage' | 'listConversations'
  >;
  return { client, endUsers, getUsage };
}

describe('adminGroupId', () => {
  it("is the admin's own group", async () => {
    const { client } = fakeClient();
    expect(await adminGroupId(client, ADMIN, 'ada@acme.test')).toBe('g-acme');
  });

  it('refuses someone not in ADMIN_EMAILS', async () => {
    const { client } = fakeClient();
    await expect(adminGroupId(client, { email: 'bob@acme.test', subTenant: 'u_bob' }, 'ada@acme.test')).rejects.toBeInstanceOf(NotAdminError);
  });

  it('refuses a listed admin on a public domain', async () => {
    const { client } = fakeClient();
    await expect(adminGroupId(client, { email: 'ada@gmail.com', subTenant: 'u_ada' }, 'ada@gmail.com')).rejects.toBeInstanceOf(NotAdminError);
  });
});

describe('personInGroup', () => {
  it('returns a person of the same company', async () => {
    const { client } = fakeClient();
    expect((await personInGroup(client, 'g-acme', 'u_bob')).subTenant).toBe('u_bob');
  });

  it('treats a person of another company as not found, and never deletes them', async () => {
    const { client, endUsers } = fakeClient();
    await expect(personInGroup(client, 'g-acme', 'u_eve')).rejects.toBeInstanceOf(NotInCompanyError);
    expect(endUsers.delete).not.toHaveBeenCalled();
  });

  it('treats an unknown person the same way', async () => {
    const { client } = fakeClient();
    await expect(personInGroup(client, 'g-acme', 'u_nobody')).rejects.toBeInstanceOf(NotInCompanyError);
  });
});

describe('companyUsage', () => {
  it('reads the SDK usage for the month: person rows summed per person, company total from the group row', async () => {
    const { client, getUsage } = fakeClient();
    const window = monthWindow('2026-11');
    const usage = await companyUsage(client, 'g-acme', window);

    expect(getUsage).toHaveBeenCalledWith({ groupBy: 'endUser', groupId: 'g-acme', since: window.since, until: window.until, cursor: undefined });
    expect(getUsage).toHaveBeenCalledWith({ groupBy: 'group', groupId: 'g-acme', since: window.since, until: window.until, cursor: undefined });
    expect(usage.total).toBe(10.5);
    expect(usage.people).toEqual([
      { subTenant: 'u_gone', displayName: 'u_gone', status: 'deleted', credits: 4 },
      { subTenant: 'u_bob', displayName: 'u_bob@acme.test', status: 'active', credits: 3.5 },
      { subTenant: 'u_ada', displayName: 'u_ada@acme.test', status: 'active', credits: 3 },
    ]);
    // Only members of the admin's group are listed.
    expect(usage.people.map((p) => p.subTenant)).not.toContain('u_eve');
  });
});

describe('monthWindow', () => {
  it('is the half-open UTC month', () => {
    const w = monthWindow('2026-12');
    expect(w.since.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(w.until.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('defaults to the current month', () => {
    expect(monthWindow(undefined, new Date('2026-11-17T12:00:00Z')).month).toBe('2026-11');
  });

  it('rejects anything else', () => {
    expect(() => monthWindow('2026-13')).toThrow(RangeError);
    expect(() => monthWindow('Nov')).toThrow(RangeError);
  });
});
