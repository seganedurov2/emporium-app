/**
 * Skeleton loading placeholder with shimmer animation.
 * Used while data is loading (e.g. mezzanine calculations, saves).
 */

import { type PropsWithChildren } from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function Skeleton({ width = '100%', height = '1em', className }: SkeletonProps) {
  return (
    <div
      className={[
        'animate-pulse rounded bg-slate-800 border border-slate-700/50',
        className
      ].filter(Boolean).join(' ')}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  lineWidth?: string | number;
  lineHeight?: string;
  className?: string;
}

export function SkeletonText({
  lines = 3,
  lineWidth = '100%',
  lineHeight = '1.1em',
  className
}: SkeletonTextProps) {
  return (
    <div className={['flex flex-col gap-1.5', className].filter(Boolean).join(' ')}>
      {[...Array(lines)].map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? lineWidth : '60%'}
          height={lineHeight}
        />
      ))}
    </div>
  );
}

interface SkeletonCardProps extends PropsWithChildren {
  className?: string;
}

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div className={['rounded-xl border border-slate-700 bg-slate-950 p-4', className].filter(Boolean).join(' ')}>
      <Skeleton width="20%" height="1em" />
      <SkeletonText lines={3} className="mt-2" />
      <Skeleton width="100%" height="4em" className="mt-3" />
    </div>
  );
}
