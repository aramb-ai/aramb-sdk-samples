import { NextResponse } from 'next/server';
import { NotAdminError, NotInCompanyError, adminGroupId, personInGroup } from '@/lib/admin';
import { aramb } from '@/lib/aramb';
import { errorResponse, failure, notFound, unauthenticated } from '@/lib/http';
import { currentViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ subTenant: string }> };

/** Resolve the target person, enforcing that they are in the admin's company. */
async function scoped(ctx: Ctx) {
  const viewer = await currentViewer();
  if (!viewer) return { response: unauthenticated() };
  const { subTenant } = await ctx.params;
  try {
    const client = aramb();
    const groupId = await adminGroupId(client, viewer, process.env.ADMIN_EMAILS);
    const person = await personInGroup(client, groupId, subTenant);
    return { client, person };
  } catch (err) {
    if (err instanceof NotAdminError) {
      return { response: errorResponse({ code: 'forbidden', message: err.message }, 403) };
    }
    if (err instanceof NotInCompanyError) return { response: notFound() };
    return { response: failure(err, 'admin-person') };
  }
}

/** GET → `{ status }` of a person of the admin's company (polled while a removal runs). */
export async function GET(_request: Request, ctx: Ctx) {
  const r = await scoped(ctx);
  if ('response' in r) return r.response;
  return NextResponse.json({ status: r.person.status });
}

/** DELETE → removes the person (their conversations go; their credits history stays). Answers `{ status }`. */
export async function DELETE(_request: Request, ctx: Ctx) {
  const r = await scoped(ctx);
  if ('response' in r) return r.response;
  try {
    const person = await r.client.endUsers.delete(r.person.subTenant);
    return NextResponse.json({ status: person.status });
  } catch (err) {
    return failure(err, 'admin-delete');
  }
}
