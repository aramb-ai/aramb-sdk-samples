import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Chat } from '@/components/Chat';
import { AGENTS, isAgentKey } from '@/lib/agents';
import { requireViewer } from '@/lib/viewer';

export const dynamic = 'force-dynamic';

export default async function ChatPage({ params }: { params: Promise<{ agent: string }> }) {
  const viewer = await requireViewer();
  const { agent } = await params;
  if (!isAgentKey(agent)) notFound();
  return (
    <>
      <p>
        <Link href="/">← Back</Link>
      </p>
      <h1>{AGENTS[agent].label}</h1>
      {/* The key scopes the stored conversation id to this person and agent in this browser. */}
      <Chat agent={agent} storageKey={`support-desk:${viewer.subTenant}:${agent}`} />
    </>
  );
}
