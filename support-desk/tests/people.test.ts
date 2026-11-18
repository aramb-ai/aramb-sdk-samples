import { ArambError, type Aramb } from '@aramb-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { messageFor, toClientError } from '../lib/errors';
import { findOrCreateCompanyGroup, upsertPerson } from '../lib/people';
import { group, person } from './fakes';

function fakeClient(groups: ReturnType<typeof group>[] = []) {
  const endUsers = { upsert: vi.fn(async (subTenant: string, patch: { groupId?: string | null }) => person(subTenant, patch.groupId ?? null)) };
  const groupsNs = {
    list: vi.fn(async () => ({ groups, nextCursor: null })),
    create: vi.fn(async ({ name, externalRef }: { name: string; externalRef?: string }) => group('g-new', name, externalRef ?? null)),
  };
  return { client: { endUsers, groups: groupsNs } as unknown as Pick<Aramb, 'endUsers' | 'groups'>, endUsers, groupsNs };
}

describe('upsertPerson', () => {
  it('puts a company person in the group named after their domain, creating it once', async () => {
    const { client, endUsers, groupsNs } = fakeClient();
    await upsertPerson(client, 'u_d_1', 'Ada@Acme.test');
    expect(groupsNs.create).toHaveBeenCalledWith({ name: 'acme.test', externalRef: 'acme.test' });
    expect(endUsers.upsert).toHaveBeenCalledWith('u_d_1', { displayName: 'Ada@Acme.test', groupId: 'g-new' });
  });

  it('matches the company by externalRef, not by a look-alike name', async () => {
    const { client, endUsers, groupsNs } = fakeClient([group('g-other', 'acme.test', null), group('g-acme', 'Acme Inc', 'acme.test')]);
    await upsertPerson(client, 'u_d_1', 'ada@acme.test');
    expect(groupsNs.create).not.toHaveBeenCalled();
    expect(endUsers.upsert).toHaveBeenCalledWith('u_d_1', { displayName: 'ada@acme.test', groupId: 'g-acme' });
  });

  it('reuses an existing group', async () => {
    const { client, endUsers, groupsNs } = fakeClient([group('g-acme', 'acme.test')]);
    await upsertPerson(client, 'u_d_1', 'ada@acme.test');
    expect(groupsNs.create).not.toHaveBeenCalled();
    expect(endUsers.upsert).toHaveBeenCalledWith('u_d_1', { displayName: 'ada@acme.test', groupId: 'g-acme' });
  });

  it('gives a public-domain person no group', async () => {
    const { client, endUsers, groupsNs } = fakeClient();
    await upsertPerson(client, 'u_g_1', 'someone@gmail.com');
    expect(groupsNs.list).not.toHaveBeenCalled();
    expect(endUsers.upsert).toHaveBeenCalledWith('u_g_1', { displayName: 'someone@gmail.com', groupId: null });
  });

  it('passes conflict through, which sign-in shows as the removal message', async () => {
    const { client, endUsers } = fakeClient([group('g-acme', 'acme.test')]);
    endUsers.upsert.mockRejectedValueOnce(new ArambError('conflict', 'deleting', { status: 409, requestId: 'req-1' }));
    const err = await upsertPerson(client, 'u_d_1', 'ada@acme.test').catch((e: unknown) => e);
    expect(toClientError(err, 'test')).toEqual({ code: 'conflict', message: messageFor('conflict'), requestId: 'req-1' });
    expect(messageFor('conflict')).toBe('This account is being removed. Try again in a few minutes.');
  });
});

describe('findOrCreateCompanyGroup', () => {
  it('reads again when a concurrent sign-in created the group first', async () => {
    const { client, groupsNs } = fakeClient();
    groupsNs.create.mockRejectedValueOnce(new ArambError('conflict', 'duplicate name'));
    groupsNs.list
      .mockResolvedValueOnce({ groups: [], nextCursor: null })
      .mockResolvedValueOnce({ groups: [group('g-acme', 'acme.test')], nextCursor: null });
    expect((await findOrCreateCompanyGroup(client, 'acme.test')).id).toBe('g-acme');
  });

  it('follows list pages', async () => {
    const { client, groupsNs } = fakeClient();
    groupsNs.list
      .mockResolvedValueOnce({ groups: [group('g-x', 'x.test')], nextCursor: 'c2' } as never)
      .mockResolvedValueOnce({ groups: [group('g-acme', 'acme.test')], nextCursor: null });
    expect((await findOrCreateCompanyGroup(client, 'acme.test')).id).toBe('g-acme');
    expect(groupsNs.list).toHaveBeenLastCalledWith({ cursor: 'c2' });
  });

  it('rethrows any other failure', async () => {
    const { client, groupsNs } = fakeClient();
    groupsNs.create.mockRejectedValueOnce(new ArambError('forbidden', 'no'));
    await expect(findOrCreateCompanyGroup(client, 'acme.test')).rejects.toMatchObject({ code: 'forbidden' });
  });
});
