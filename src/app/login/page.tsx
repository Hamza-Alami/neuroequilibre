import { connection } from 'next/server';
import { Suspense } from 'react';
import { SetupRequired } from '@/components/app/SetupRequired';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Connexion — NeuroÉquilibre' };

export default async function LoginPage() {
  await connection();
  if (!isSupabaseConfigured()) return <SetupRequired />;
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
