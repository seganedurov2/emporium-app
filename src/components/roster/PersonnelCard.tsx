import type { ReactNode } from 'react';
import { getTerm, type Platform } from '../../terminology';
import type { Character } from '../../gameEngine';
import { Portrait3D } from '../Portrait3D';

export interface PersonnelMetric {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}

interface PersonnelCardProps {
  character: Character;
  accentClassName: string;
  badges?: ReactNode;
  metrics: PersonnelMetric[];
  details?: ReactNode;
  actions?: ReactNode;
  onPreviewImage?: (imageUrl: string) => void;
  platform: Platform;
}

export function PersonnelCard({
  character,
  accentClassName,
  badges,
  metrics,
  details,
  actions,
  onPreviewImage,
  platform
}: PersonnelCardProps) {
  return (
    <article className={`flex min-w-0 gap-2 rounded-lg border border-slate-700 bg-slate-950 p-2 text-left transition hover:border-slate-500 ${accentClassName}`}>
      <div className="relative h-32 w-20 shrink-0 overflow-hidden rounded-md border border-slate-700 bg-slate-900 sm:h-36 sm:w-24">
        <Portrait3D
          model={character.model3d}
          poster={character.image}
          alt={`Портрет: ${character.name}`}
          className="h-full w-full object-cover"
          onPreviewImage={onPreviewImage}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-start justify-between gap-1">
           <div className="min-w-0">
             <h3 className="truncate text-xs font-semibold text-slate-100" title={character.name}>{character.name}</h3>
             <p className="truncate text-[10px] italic text-slate-400" title={character.role}>{getTerm(character.role, platform)}</p>
           </div>

          {badges}
        </div>

        <dl className="mt-2 grid grid-cols-3 gap-x-1.5 gap-y-1 border-y border-slate-800 py-1.5">
          {metrics.slice(0, 6).map((metric, index) => (
            <div key={`${metric.label}-${index}`} className="min-w-0 text-center">
              <dt className="truncate text-[9px] leading-3 text-slate-500" title={metric.label}>{metric.label}</dt>
              <dd className={`truncate font-mono text-[11px] leading-4 text-slate-200 ${metric.valueClassName ?? ''}`} title={typeof metric.value === 'string' || typeof metric.value === 'number' ? String(metric.value) : undefined}>{metric.value}</dd>
            </div>
          ))}
        </dl>

        {details && <div className="mt-1.5 min-w-0 text-[10px] leading-relaxed text-slate-400">{details}</div>}
        {actions && <div className="mt-auto pt-2">{actions}</div>}
      </div>
    </article>
  );
}
