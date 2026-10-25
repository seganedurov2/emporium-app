import type { ReactNode } from 'react';

export interface VenueBannerProps {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  accentClassName: string;
  summary: ReactNode;
}

export function VenueBanner({
  title,
  description,
  imageSrc,
  imageAlt,
  accentClassName,
  summary
}: VenueBannerProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950" aria-label={title}>
      <div className="relative isolate h-40 overflow-hidden sm:h-48 lg:h-56">
        <img
          src={imageSrc}
          alt={imageAlt}
          width={1600}
          height={560}
          className="absolute inset-0 h-full w-full object-cover object-center"
          style={{ width: '100%', height: '100%' }}
          loading="lazy"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-slate-950/10" />
        <div className="absolute inset-x-4 bottom-4 mx-auto max-w-5xl text-center sm:bottom-5">
          <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${accentClassName}`}>Emporium · заведение</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-white drop-shadow sm:text-2xl">{title}</h1>
          <p className="mx-auto mt-1 line-clamp-2 max-w-3xl text-xs leading-relaxed text-slate-200/85 sm:text-sm">{description}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-800 bg-slate-950/95 px-3 py-2.5 text-xs sm:px-4">
        {summary}
      </div>
    </section>
  );
}
