'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarDays,
  CalendarPlus,
  ChartColumn,
  ClipboardList,
  Clock,
  Compass,
  FileText,
  History,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  MessageSquareText,
  Package,
  Settings,
  SquareStack,
  UserPlus,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ComponentType, type ReactNode } from 'react';
import { Logo } from '@/components/layout/Logo';
import { RoleBadge } from '@/components/ui/Badge';
import { cn, getInitials } from '@/lib/utils';
import { useApp } from './AppProvider';

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
}

const MAIN_NAV: NavItem[] = [
  { href: '/', label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
  { href: '/planning', label: 'Planning', icon: CalendarDays },
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/packs', label: 'Packs', icon: Package },
  { href: '/messages', label: 'Messages groupés', icon: Megaphone },
  { href: '/etats', label: 'États', icon: ChartColumn },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/admin/boxes', label: 'Boxes & blocages', icon: SquareStack },
  { href: '/admin/horaires', label: 'Horaires & séances', icon: Clock },
  { href: '/admin/questionnaire', label: 'Questionnaire', icon: ClipboardList },
  { href: '/admin/kyc', label: 'Formulaire KYC', icon: FileText },
  { href: '/admin/sources', label: 'Origine des clients', icon: Compass },
  { href: '/admin/messages', label: 'Modèles de messages', icon: MessageSquareText },
  { href: '/admin/utilisateurs', label: 'Utilisateurs', icon: UsersRound },
  { href: '/admin/journal', label: 'Journal', icon: History },
  { href: '/admin/parametres', label: 'Paramètres', icon: Settings },
];

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item);
  return (
    <Link
      href={item.href}
      className={cn(
        'group flex h-9 items-center gap-3 rounded-lg px-3 text-[14px] transition-colors',
        active ? 'bg-navy-50 font-medium text-navy' : 'text-ink-soft hover:bg-surface-muted hover:text-ink'
      )}
    >
      <item.icon className={cn('h-4 w-4', active ? 'text-navy' : 'text-ink-muted group-hover:text-ink-soft')} />
      {item.label}
    </Link>
  );
}

function SidebarContent({ pathname }: { pathname: string }) {
  const { profile, isAdmin, settings } = useApp();

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-5">
        <Link href="/" className="inline-flex">
          <Logo size="sm" priority />
        </Link>
        <p className="mt-2 truncate text-[12px] text-ink-muted">{settings.centre_name}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 pb-4">
        <Link
          href="/sessions/new"
          className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-navy text-[13px] font-medium text-white hover:bg-navy-600"
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          Réserver
        </Link>
        <Link
          href="/clients/new"
          className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface text-[13px] font-medium text-ink hover:bg-surface-muted"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Client
        </Link>
      </div>

      <nav className="scrollbar-thin flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        <div className="space-y-0.5">
          {MAIN_NAV.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
        {isAdmin && (
          <div>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              Administration
            </p>
            <div className="space-y-0.5">
              {ADMIN_NAV.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="border-t border-line p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-[12px] font-semibold text-white">
            {getInitials(profile.full_name.split(' ')[0] ?? '', profile.full_name.split(' ')[1] ?? '') || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-ink">{profile.full_name || profile.email}</p>
            <div className="mt-0.5">
              <RoleBadge role={profile.role} />
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              title="Se déconnecter"
              className="rounded-lg p-2 text-ink-muted hover:bg-danger-50 hover:text-danger"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  if (openedAt !== pathname) {
    setOpenedAt(pathname);
    setOpen(false);
  }

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-line bg-surface lg:block">
        <SidebarContent pathname={pathname} />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-4 backdrop-blur lg:hidden">
        <Link href="/">
          <Logo size="xs" priority />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg p-2 text-ink-soft hover:bg-navy-50"
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <motion.div
              className="absolute inset-0 bg-navy-700/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              className="absolute inset-y-0 left-0 w-[280px] bg-surface shadow-pop"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'tween', duration: 0.2 }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-3 top-4 rounded-lg p-1.5 text-ink-muted hover:bg-navy-50"
                aria-label="Fermer le menu"
              >
                <X className="h-4 w-4" />
              </button>
              <SidebarContent pathname={pathname} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <main className="lg:pl-[248px]">
        <div className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">{children}</div>
      </main>
    </div>
  );
}
