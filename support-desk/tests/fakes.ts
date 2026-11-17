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

export function group(id: string, name: string): Group {
  return { id, name, externalRef: null, metadata: {}, createdAt: '2026-11-01T00:00:00Z' };
}
