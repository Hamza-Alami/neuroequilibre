import { ReportTabs } from '@/components/reports/ReportTabs';
import { PageHeader } from '@/components/ui/Card';

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeader eyebrow="Suivi" title="États" description="Tableaux de suivi exportables en CSV (Excel) et PDF." />
      <ReportTabs />
      {children}
    </>
  );
}
