'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { UserPlus, Calendar, Users, ArrowRight, Activity, Sparkles } from 'lucide-react';
import { PageShell } from '@/components/layout/Header';
import { Card, PageTitle } from '@/components/ui/Card';
import { PulseOrb } from '@/components/layout/NeuralBackground';
import { NeuralLoader } from '@/components/ui/NeuralLoader';
import { localDb } from '@/lib/data/local-store';

const actions = [
  {
    href: '/clients/new',
    icon: UserPlus,
    title: 'Nouveau client',
    description: 'Créer un profil et compléter le formulaire KYC',
    gradient: 'from-[#8ecae6]/30 to-[#7eb09a]/20',
    accent: '#5ba4c9',
    ring: 'ring-[#5ba4c9]/20',
  },
  {
    href: '/sessions/new',
    icon: Calendar,
    title: 'Réserver une séance',
    description: 'Planifier une session pour un client nouveau ou existant',
    gradient: 'from-[#b8a9d4]/25 to-[#8ecae6]/20',
    accent: '#b8a9d4',
    ring: 'ring-[#b8a9d4]/20',
  },
  {
    href: '/clients',
    icon: Users,
    title: 'Profils clients',
    description: 'Consulter les dossiers et suivre l\'évolution',
    gradient: 'from-[#7eb09a]/25 to-[#b8a9d4]/15',
    accent: '#7eb09a',
    ring: 'ring-[#7eb09a]/20',
  },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState({ clients: 0, sessions: 0, assessments: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      const clients = localDb.getClients();
      const sessions = localDb.getSessions();
      setStats({
        clients: clients.length,
        sessions: sessions.length,
        assessments: clients.reduce((acc, c) => acc + localDb.getClientAssessments(c.id).length, 0),
      });
      setReady(true);
    }, 400);
    return () => clearTimeout(t);
  }, []);

  if (!ready) {
    return (
      <PageShell>
        <NeuralLoader label="Initialisation..." />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex-1">
          <PageTitle
            title="Bienvenue"
            subtitle="Gérez vos clients, planifiez les séances et suivez les progrès de chaque parcours neurofeedback."
          />

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Clients', value: stats.clients, icon: Users, color: '#5ba4c9' },
              { label: 'Séances', value: stats.sessions, icon: Calendar, color: '#7eb09a' },
              { label: 'Évaluations', value: stats.assessments, icon: Activity, color: '#b8a9d4' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                className="glass group rounded-2xl p-5 transition-shadow hover:shadow-[0_8px_28px_-8px_rgba(91,164,201,0.15)]"
              >
                <div
                  className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: `${stat.color}18` }}
                >
                  <stat.icon className="h-4 w-4" style={{ color: stat.color }} strokeWidth={1.75} />
                </div>
                <motion.p
                  className="text-[32px] font-light tabular-nums text-[#1a1d26]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.1 }}
                >
                  {stat.value}
                </motion.p>
                <p className="text-[12px] font-medium text-[#6b7280]">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
          className="hidden lg:block"
        >
          <PulseOrb className="h-52 w-52" />
        </motion.div>
      </div>

      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {actions.map((action, i) => (
          <Link key={action.href} href={action.href}>
            <Card hover delay={0.1 + i * 0.1} className={`h-full ring-1 ${action.ring}`}>
              <motion.div
                className={`mb-5 inline-flex rounded-2xl bg-gradient-to-br ${action.gradient} p-3.5 ring-1 ring-white/50`}
                whileHover={{ scale: 1.05, rotate: 3 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                <action.icon
                  className="h-5 w-5"
                  style={{ color: action.accent }}
                  strokeWidth={1.75}
                />
              </motion.div>
              <h3 className="text-[17px] font-semibold text-[#1a1d26]">{action.title}</h3>
              <p className="mt-2 text-[14px] font-light leading-relaxed text-[#6b7280]">
                {action.description}
              </p>
              <motion.div
                className="mt-5 flex items-center gap-1.5 text-[13px] font-medium text-[#5ba4c9]"
                whileHover={{ x: 4 }}
              >
                Accéder
                <ArrowRight className="h-3.5 w-3.5" />
              </motion.div>
            </Card>
          </Link>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.6 }}
        className="glass-strong mt-16 overflow-hidden rounded-3xl p-8 text-center"
      >
        <div className="mb-3 flex justify-center">
          <Sparkles className="h-4 w-4 text-[#b8a9d4]" />
        </div>
        <p className="text-[11px] font-semibold tracking-[0.25em] text-[#6b7280] uppercase">
          NeuroÉquilibre
        </p>
        <p className="mx-auto mt-3 max-w-md text-[15px] font-light leading-relaxed text-[#1a1d26]">
          L&apos;équilibre neural commence par la compréhension de soi.
          Chaque séance est une étape vers une meilleure régulation cognitive et émotionnelle.
        </p>
      </motion.div>
    </PageShell>
  );
}
