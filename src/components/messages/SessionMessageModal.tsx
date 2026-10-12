'use client';

import { getClient } from '@/lib/db/clients';
import { useAsync } from '@/lib/hooks';
import type { SessionWithRelations } from '@/lib/types';
import { MessageModal } from './MessageModal';

/** Confirmation / reminder for one session, opened from the planning or a session card. */
export function SessionMessageModal({ session, open, onClose }: { session: SessionWithRelations; open: boolean; onClose: () => void }) {
  const data = useAsync(async () => {
    if (!open) return null;
    const client = await getClient(session.client_id);
    const bookedRecently = Date.now() - new Date(session.created_at).getTime() < 24 * 3600 * 1000;
    return { client, kind: bookedRecently ? ('confirmation' as const) : ('reminder' as const) };
  }, [open, session.client_id, session.created_at]);
  if (!open || !data.data?.client) return null;
  return (
    <MessageModal
      open
      client={data.data.client}
      sessions={[session]}
      initialKind={data.data.kind}
      initialSessionId={session.id}
      onClose={onClose}
    />
  );
}
