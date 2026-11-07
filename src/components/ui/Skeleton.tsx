/**
 * Пульсирующая заготовка (скелетон), показываемая вместо контента
 * пока большая вкладка ещё не отрендерена.
 */
import { useEffect, useState } from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  count?: number;
  isLoading?: boolean;
}

export function Skeleton({
  className = '',
  width = '100%',
  height = 16,
  count = 3,
  isLoading = true
}: SkeletonProps) {
  const [active, setActive] = useState(isLoading);
  useEffect(() => {
    setActive(isLoading);
    const t = setTimeout(() => setActive(false), 700);
    return () => clearTimeout(t);
  }, [isLoading]);
  if (!active) return null;
  return (
    <div className={`animate-pulse space-y-2 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-slate-800 rounded h-full w-full mb-1"
          style={{ width, height }}
        />
      ))}
    </div>
  );
}
