import Link from 'next/link';
import { ErrorNotice } from '@/components/ErrorNotice';
import { companyUsage } from '@/lib/admin';
import { loadAdmin } from '@/lib/admin-page';
import { monthWindow, type MonthWindow } from '@/lib/month';
import { requireViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

const credits = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const viewer = await requireViewer();
  const { month } = await searchParams;
  let window: MonthWindow;
  try {
    window = monthWindow(month);
  } catch (err) {
    return <ErrorNotice error={{ code: 'bad_request', message: (err as Error).message }} />;
  }
  const result = await loadAdmin(viewer, (client, groupId) => companyUsage(client, groupId, window));
  return (
    <>
      <p>
        <Link href="/">← Back</Link>
      </p>
      <h1>Company dashboard</h1>
      <form className="row" method="get">
        <label htmlFor="month">Month</label>
        <input id="month" name="month" type="month" defaultValue={window.month} required />
        <button type="submit">Show</button>
      </form>
      {'error' in result ? (
        <ErrorNotice error={result.error} />
      ) : (
        <>
          <p>
            Company total for {window.month}: <strong>{credits.format(result.data.total)}</strong> credits
          </p>
          <table>
            <thead>
              <tr>
                <th>Person</th>
                <th>Status</th>
                <th>Credits</th>
              </tr>
            </thead>
            <tbody>
              {result.data.people.map((p) => (
                <tr key={p.subTenant}>
                  <td>
                    {p.status === 'deleted' ? (
                      p.displayName
                    ) : (
                      <Link href={`/admin/people/${encodeURIComponent(p.subTenant)}`}>{p.displayName}</Link>
                    )}
                  </td>
                  <td>{p.status}</td>
                  <td>{credits.format(p.credits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.data.creditRateAsOf ? (
            <p className="muted">Credits at the rate as of {result.data.creditRateAsOf}.</p>
          ) : null}
        </>
      )}
    </>
  );
}
