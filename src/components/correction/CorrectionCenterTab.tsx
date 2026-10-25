import { useState } from 'react';
import { ShieldAlert, HeartPulse } from 'lucide-react';
import type { Character } from '../../gameEngine';
import {
  CORRECTION_COURSES,
  CORRECTION_COURSE_BY_ID,
  CORRECTION_INTENSITY_LABELS,
  type CorrectionCourseId,
  type CorrectionEnrolment,
  type CorrectionIntensity,
  convertFear,
  FEAR_TO_ASSIMILATION_THRESHOLD
} from '../../correctionEngine';
import { describeWounds } from '../../woundEngine';

interface CorrectionCenterTabProps {
  roster: Character[];
  enrolments: CorrectionEnrolment[];
  week: number;
  hasMedic: boolean;
  onEnroll: (characterId: string, courseId: CorrectionCourseId, intensity: CorrectionIntensity) => void;
  onCancel: (characterId: string) => void;
}

const CARD = 'bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl';
const CONTROL =
  'bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-rose-500 focus:outline-none';

export function CorrectionCenterTab({
  roster,
  enrolments,
  week,
  hasMedic,
  onEnroll,
  onCancel
}: CorrectionCenterTabProps) {
  const [courseId, setCourseId] = useState<CorrectionCourseId>('adaptation');
  const [intensity, setIntensity] = useState<CorrectionIntensity>('standard');

  const course = CORRECTION_COURSE_BY_ID[courseId];
  const enrolledIds = new Set(enrolments.map(enrolment => enrolment.characterId));
  const enrolled = enrolments
    .map(enrolment => ({ enrolment, character: roster.find(char => char.id === enrolment.characterId) }))
    .filter((entry): entry is { enrolment: CorrectionEnrolment; character: Character } => Boolean(entry.character));

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center gap-3">
        <ShieldAlert className="w-7 h-7 text-rose-400" />
        <div>
          <h2 className="text-xl font-bold text-white">Центр коррекции</h2>
          <p className="text-sm text-slate-400">
            Планомерный рост страха. Страх выше {FEAR_TO_ASSIMILATION_THRESHOLD} постепенно переходит в ассимиляцию.
          </p>
        </div>
      </div>

      <div className={`${CARD} flex items-center gap-3`}>
        <HeartPulse className={`w-5 h-5 ${hasMedic ? 'text-emerald-400' : 'text-slate-600'}`} />
        <p className="text-sm text-slate-300">
          Автоматический медик: {hasMedic ? <span className="text-emerald-400 font-semibold">на посту</span> : <span className="text-rose-400 font-semibold">не назначен</span>}
          {hasMedic ? ' — травмы на курсах обрабатываются на месте, тяжесть снижается вдвое.' : ' — раны на курсах не обрабатываются.'}
        </p>
      </div>

      <div className={CARD}>
        <h3 className="font-bold text-white mb-3">Курсы</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {CORRECTION_COURSES.map(definition => (
            <div key={definition.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-white">{definition.name}</h4>
                <span className="text-xs font-mono text-slate-400">{definition.durationWeeks} нед.</span>
              </div>
              <p className="text-xs text-slate-400">{definition.shortDescription}</p>
              <div className="text-xs text-slate-300 font-mono space-y-0.5">
                <p>Цель страха: {definition.fearTarget}</p>
                <p>Взнос: {definition.weeklyFee > 0 ? `${definition.weeklyFee} AX/нед.` : 'бесплатно'}</p>
                {definition.weeklyIncome > 0 && <p>Доход центра: {definition.weeklyIncome} AX/нед.</p>}
                <p>Риск травмы: {Math.round(definition.injuryChance * 100)}%/нед.</p>
                {definition.developsSkills.length > 0 && <p>Навыки: {definition.developsSkills.join(', ')}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={CARD}>
        <h3 className="font-bold text-white mb-3">Запись в группу</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm text-slate-300">
            Курс
            <select className={`${CONTROL} mt-1 w-full`} value={courseId} onChange={event => setCourseId(event.target.value as CorrectionCourseId)}>
              {CORRECTION_COURSES.map(definition => (
                <option key={definition.id} value={definition.id}>{definition.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-300">
            Интенсивность
            <select className={`${CONTROL} mt-1 w-full`} value={intensity} onChange={event => setIntensity(event.target.value as CorrectionIntensity)}>
              {(Object.keys(CORRECTION_INTENSITY_LABELS) as CorrectionIntensity[]).map(key => (
                <option key={key} value={key}>{CORRECTION_INTENSITY_LABELS[key]}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Курс «{course.name}»: цель {course.fearTarget}, {course.durationWeeks} недель, риск травмы {Math.round(course.injuryChance * 100)}%/нед.
        </p>
        <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
          {roster.map(character => {
            const isEnrolled = enrolledIds.has(character.id);
            const fear = character.fear ?? 0;
            const assimilation = character.assimilation ?? 0;
            const conversion = convertFear(fear, assimilation);
            const eligible = fear >= course.minFear;
            return (
              <div key={character.id} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                <div className="text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{character.name}</span>
                    <span className="text-xs text-slate-400 font-mono">страх {Math.round(fear)} · ассим. {Math.round(assimilation)}</span>
                  </div>
                  {(character.wounds?.length ?? 0) > 0 && (
                    <p className="text-[11px] text-rose-400 font-mono">Раны: {describeWounds(character)}</p>
                  )}
                  {conversion.converted > 0 && (
                    <p className="text-[11px] text-purple-400 font-mono">+{conversion.converted} ассимиляции на следующей неделе</p>
                  )}
                </div>
                {isEnrolled ? (
                  <button className="text-xs text-rose-400 hover:underline" onClick={() => onCancel(character.id)}>Вывести</button>
                ) : (
                  <button
                    className="text-xs text-rose-400 hover:underline disabled:text-slate-600 disabled:no-underline"
                    disabled={!eligible}
                    title={eligible ? undefined : `Нужен страх не ниже ${course.minFear}`}
                    onClick={() => onEnroll(character.id, courseId, intensity)}
                  >
                    Записать
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={CARD}>
        <h3 className="font-bold text-white mb-3">На курсах ({enrolled.length})</h3>
        {enrolled.length === 0 ? (
          <p className="text-sm text-slate-400">Группы пусты.</p>
        ) : (
          <div className="space-y-2">
            {enrolled.map(({ enrolment, character }) => {
              const definition = CORRECTION_COURSE_BY_ID[enrolment.courseId];
              const progress = Math.round((enrolment.weeksAttended / definition.durationWeeks) * 100);
              return (
                <div key={enrolment.characterId} className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white font-medium">{character.name}</span>
                    <span className="text-xs text-slate-400">
                      {definition.name} · {CORRECTION_INTENSITY_LABELS[enrolment.intensity]}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 font-mono">
                    {enrolment.weeksAttended}/{definition.durationWeeks} нед. · начат на неделе {enrolment.startedWeek} (текущая {week})
                    {enrolment.hospitalised ? ' · в Больнице' : ''}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
