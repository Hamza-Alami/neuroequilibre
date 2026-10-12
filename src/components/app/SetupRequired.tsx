import { Database } from 'lucide-react';
import { Logo } from '@/components/layout/Logo';

export function SetupRequired({ reason = 'env' }: { reason?: 'env' | 'schema' }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-8 shadow-card">
        <Logo size="sm" />
        <div className="mt-8 flex h-11 w-11 items-center justify-center rounded-xl bg-gold-50 text-gold-700">
          <Database className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-[20px] font-semibold text-ink">Configuration requise</h1>
        {reason === 'env' ? (
          <div className="mt-2 space-y-3 text-[14px] leading-relaxed text-ink-soft">
            <p>La base de données n&apos;est pas encore connectée. Ajoutez ces variables d&apos;environnement :</p>
            <ul className="space-y-1 rounded-xl bg-surface-muted p-4 font-mono text-[12px] text-ink">
              <li>NEXT_PUBLIC_SUPABASE_URL</li>
              <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
              <li>SUPABASE_SERVICE_ROLE_KEY</li>
            </ul>
            <p>Puis redémarrez l&apos;application (ou redéployez sur Vercel).</p>
          </div>
        ) : (
          <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
            La base de données est connectée mais le schéma n&apos;est pas installé. Exécutez le fichier{' '}
            <code className="rounded bg-surface-muted px-1.5 py-0.5 text-[12px]">supabase/schema.sql</code> dans
            l&apos;éditeur SQL de Supabase.
          </p>
        )}
      </div>
    </div>
  );
}
