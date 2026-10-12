'use client';

import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Logo } from '@/components/layout/Logo';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Feedback';
import { Field, Input } from '@/components/ui/Field';
import { getSupabase } from '@/lib/supabase/client';

function translateAuthError(message: string) {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (m.includes('banned')) return 'Ce compte est désactivé. Contactez l\u2019administrateur.';
  if (m.includes('email not confirmed')) return 'Adresse email non confirmée.';
  if (m.includes('fetch')) return 'Connexion au serveur impossible. Vérifiez votre accès internet.';
  return message;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get('error') === 'inactive' ? 'Ce compte est désactivé. Contactez l\u2019administrateur.' : null
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Saisissez votre email et votre mot de passe.');
      return;
    }
    setLoading(true);
    const { error: authError } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (authError) {
      setError(translateAuthError(authError.message));
      setLoading(false);
      return;
    }
    const next = params.get('next');
    router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
    router.refresh();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-navy-700 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(200,150,62,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(42,64,102,0.9),transparent_60%)]" />
        <svg className="absolute inset-0 h-full w-full opacity-[0.08]" aria-hidden>
          <defs>
            <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M48 0H0V48" fill="none" stroke="white" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-gold-100/80">
            Centre de neurofeedback
          </p>
          <div className="max-w-md">
            <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.02em]">
              Le suivi de vos clients, séance après séance.
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-white/65">
              Planning des boxes, dossiers clients, évaluations et évolution — réunis dans un espace
              clair et sécurisé.
            </p>
          </div>
          <p className="text-[12px] text-white/40">© NeuroÉquilibre Centre</p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Logo size="md" priority />
          <h2 className="mt-10 text-[22px] font-semibold tracking-[-0.01em] text-ink">Connexion</h2>
          <p className="mt-1 text-[14px] text-ink-muted">Accès réservé à l&apos;équipe du centre.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
            {error && <Alert tone="error">{error}</Alert>}
            <Field label="Email" htmlFor="email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 pl-10"
                  placeholder="prenom@neuroequilibre.ma"
                  autoFocus
                />
              </div>
            </Field>
            <Field label="Mot de passe" htmlFor="password">
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            <Button type="submit" size="lg" fullWidth loading={loading}>
              Se connecter
            </Button>
          </form>
          <p className="mt-6 text-[12px] leading-relaxed text-ink-muted">
            Mot de passe oublié ? Demandez à l&apos;administrateur du centre de le réinitialiser.
          </p>
        </div>
      </div>
    </div>
  );
}
