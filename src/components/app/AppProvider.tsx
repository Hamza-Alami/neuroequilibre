'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { listBoxes, getSettings } from '@/lib/db/settings';
import { setCentreTimezone } from '@/lib/time';
import type { Box, CentreSettings, Profile } from '@/lib/types';
import { ToastProvider } from '@/components/ui/Toast';

interface AppContextValue {
  profile: Profile;
  isAdmin: boolean;
  settings: CentreSettings;
  boxes: Box[];
  activeBoxes: Box[];
  boxById: Map<string, Box>;
  refreshConfig: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  profile,
  initialSettings,
  initialBoxes,
  children,
}: {
  profile: Profile;
  initialSettings: CentreSettings;
  initialBoxes: Box[];
  children: ReactNode;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [boxes, setBoxes] = useState(initialBoxes);
  setCentreTimezone(settings.timezone);

  const refreshConfig = useCallback(async () => {
    const [s, b] = await Promise.all([getSettings(), listBoxes()]);
    setSettings(s);
    setBoxes(b);
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      profile,
      isAdmin: profile.role === 'admin',
      settings,
      boxes,
      activeBoxes: boxes.filter((b) => b.is_active),
      boxById: new Map(boxes.map((b) => [b.id, b])),
      refreshConfig,
    }),
    [profile, settings, boxes, refreshConfig]
  );

  return (
    <AppContext.Provider value={value}>
      <ToastProvider>{children}</ToastProvider>
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
