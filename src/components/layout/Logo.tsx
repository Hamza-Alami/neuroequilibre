import Image from 'next/image';
import { cn } from '@/lib/utils';

const LOGO_SRC = '/neuroequilibre-logo.png';
const LOGO_RATIO = 681 / 366;

const sizes = {
  xs: { height: 30, className: 'h-[30px]' },
  sm: { height: 40, className: 'h-10' },
  md: { height: 52, className: 'h-[52px]' },
  lg: { height: 72, className: 'h-[72px]' },
};

export function Logo({
  size = 'md',
  className,
  priority,
}: {
  size?: keyof typeof sizes;
  className?: string;
  priority?: boolean;
}) {
  const { height, className: sizeClass } = sizes[size];
  return (
    <Image
      src={LOGO_SRC}
      alt="NeuroÉquilibre Centre — Neural Feedback"
      width={Math.round(height * LOGO_RATIO)}
      height={height}
      priority={priority}
      className={cn('w-auto object-contain', sizeClass, className)}
    />
  );
}
