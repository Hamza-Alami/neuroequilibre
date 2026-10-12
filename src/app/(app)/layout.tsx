import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { AppProvider } from '@/components/app/AppProvider';
import { AppShell } from '@/components/app/AppShell';
import { SetupRequired } from '@/components/app/SetupRequired';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createServerSupabase } from '@/lib/supabase/server';
import type { Box, CentreSettings, Profile } from '@/lib/types';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await connection();
  if (!isSupabaseConfigured()) return <SetupRequired />;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [profileRes, settingsRes, boxesRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, role, is_active, created_at').eq('id', user.id).maybeSingle(),
    supabase.from('centre_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('boxes').select('*').order('sort_order').order('name'),
  ]);

  const profile = profileRes.data as Profile | null;
  if (!profile || !profile.is_active) redirect('/auth/signout?reason=inactive');

  if (!settingsRes.data) {
    return <SetupRequired reason="schema" />;
  }
  if (!('currency_label' in settingsRes.data)) {
    return <SetupRequired reason="migration" />;
  }

  return (
    <AppProvider
      profile={profile}
      initialSettings={settingsRes.data as CentreSettings}
      initialBoxes={(boxesRes.data ?? []) as Box[]}
    >
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
