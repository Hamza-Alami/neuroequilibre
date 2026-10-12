'use client';

import { Cake, UserCheck, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/etats/anniversaires', label: 'Anniversaires', icon: Cake },
  { href: '/etats/statuts', label: 'Clients actifs / inactifs', icon: UserCheck },
  { href: '/etats/packs', label: 'Packs vendus', icon: Wallet },
];

export function ReportTabs() {
  const pathname = usePathname();
  return (
    <div className="scrollbar-thin -mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-line px-1">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'relative -mb-px inline-flex h-10 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-[14px] font-medium transition-colors',
              active ? 'border-navy text-ink' : 'border-transparent text-ink-muted hover:text-ink'
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
