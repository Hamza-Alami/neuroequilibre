'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const LOGO_SRC = '/neuroequilibre-logo.png';
const LOGO_RATIO = 681 / 366;

const sizes = {
  xs: { height: 28, className: 'h-7' },
  sm: { height: 36, className: 'h-9' },
  md: { height: 44, className: 'h-11' },
  lg: { height: 56, className: 'h-14' },
  xl: { height: 80, className: 'h-20' },
};

interface LogoProps {
  size?: keyof typeof sizes;
  className?: string;
  priority?: boolean;
}

export function Logo({ size = 'md', className, priority }: LogoProps) {
  const { height, className: sizeClass } = sizes[size];
  const width = Math.round(height * LOGO_RATIO);

  return (
    <Image
      src={LOGO_SRC}
      alt="NeuroÉquilibre Centre — Neural Feedback"
      width={width}
      height={height}
      priority={priority}
      className={cn('w-auto object-contain', sizeClass, className)}
    />
  );
}

interface LogoLinkProps extends LogoProps {
  href?: string;
}

export function LogoLink({ href = '/', size = 'md', className, priority = true }: LogoLinkProps) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center">
      <motion.span
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        className={cn('block overflow-hidden rounded-xl', className)}
      >
        <Logo size={size} priority={priority} />
      </motion.span>
    </Link>
  );
}
