import type { EndUser, Group } from '@aramb-ai/sdk';

/** A person record as the SDK returns it, with test defaults. */
export function person(subTenant: string, groupId: string | null, extra: Partial<EndUser> = {}): EndUser {
  return {
    id: `id-${subTenant}`,
    subTenant,
    displayName: `${subTenant}@acme.test`,
    metadata: {},
    groupId,
    createdAt: '2026-11-01T00:00:00Z',
    lastSeenAt: '2026-11-01T00:00:00Z',
    status: 'active',
    deletedAt: null,
    ...extra,
  };
}

/** A company group: name and externalRef are the domain unless given. */
export function group(id: string, name: string, externalRef: string | null = name): Group {
  return { id, name, externalRef, metadata: {}, createdAt: '2026-11-01T00:00:00Z' };
}
