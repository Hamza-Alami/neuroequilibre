'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, UserPlus, Calendar, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NeuralBackground } from './NeuralBackground';
import { LogoLink } from './Logo';

const navItems = [
  { href: '/', label: 'Accueil', icon: Home },
  { href: '/clients/new', label: 'Nouveau client', icon: UserPlus },
  { href: '/sessions/new', label: 'Réserver', icon: Calendar },
  { href: '/clients', label: 'Clients', icon: Users },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/40 bg-white/50 backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <LogoLink size="sm" className="sm:hidden" />
        <LogoLink size="md" className="hidden sm:block" />

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <motion.span
                  className={cn(
                    'relative flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-medium transition-colors',
                    isActive ? 'text-white' : 'text-[#6b7280] hover:text-[#1a1d26]'
                  )}
                  whileTap={{ scale: 0.97 }}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-full bg-gradient-to-r from-[#8a7348] to-[#c5944e] shadow-[0_4px_16px_-4px_rgba(197,148,78,0.4)]"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className="relative z-10 h-3.5 w-3.5" strokeWidth={1.75} />
                  <span className="relative z-10">{item.label}</span>
                </motion.span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export function PageShell({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="mesh-bg relative min-h-screen">
      <NeuralBackground />
      <Header />
      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={cn('relative mx-auto max-w-6xl px-6 py-10', className)}
      >
        {children}
      </motion.main>
    </div>
  );
}
