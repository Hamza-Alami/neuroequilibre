import { useMemo, useSyncExternalStore } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { unwrap } from './errors';

const LEGACY_KEY = 'neuroequilibre_data';

export interface LegacyStore {
  clients: unknown[];
  sessions: unknown[];
  assessments: unknown[];
  responses: unknown[];
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(LEGACY_KEY);
  } catch {
    return null;
  }
}

function parseLegacy(raw: string | null): LegacyStore | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<LegacyStore>;
    const store = {
      clients: data.clients ?? [],
      sessions: data.sessions ?? [],
      assessments: data.assessments ?? [],
      responses: data.responses ?? [],
    };
    return store.clients.length ? store : null;
  } catch {
    return null;
  }
}

/** Data saved by the previous (browser-only) version of the app, if any. */
export function useLegacyData(): LegacyStore | null {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => parseLegacy(raw), [raw]);
}

export async function importLegacyData(store: LegacyStore) {
  const res = await getSupabase().rpc('import_legacy_data', { p_payload: store });
  return unwrap(res) as { clients: number; sessions: number; assessments: number };
}

export function clearLegacyData() {
  window.localStorage.removeItem(LEGACY_KEY);
  listeners.forEach((l) => l());
}
