import { useMemo, useState } from 'react';
import { GraduationCap, Users } from 'lucide-react';
import type { Character } from '../../gameEngine';
import {
  SCHOOL_COURSES,
  SCHOOL_COURSE_BY_ID,
  type SchoolCourseId,
  type SchoolEnrolment,
  type TeacherProfile,
  canTeachCourse,
  studentSkillCap,
  teachingQuality
} from '../../schoolEngine';

interface SchoolTabProps {
  roster: Character[];
  enrolments: SchoolEnrolment[];
  teachers: TeacherProfile[];
  week: number;
  onEnroll: (characterId: string, courseId: SchoolCourseId) => void;
  onCancel: (characterId: string) => void;
}

const CARD = 'bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl';
const CONTROL =
  'bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-amber-500 focus:outline-none';

export function SchoolTab({ roster, enrolments, teachers, week, onEnroll, onCancel }: SchoolTabProps) {
  const [courseId, setCourseId] = useState<SchoolCourseId>('basic');
  const [teacherName, setTeacherName] = useState<string>(teachers[0]?.name ?? '');

  const teacher = useMemo(
    () => teachers.find(candidate => candidate.name === teacherName) ?? teachers[0] ?? null,
    [teacherName, teachers]
  );

  const course = SCHOOL_COURSE_BY_ID[courseId];
  const quality = teacher ? teachingQuality(teacher) : 0;
  const cap = teacher ? studentSkillCap(teacher) : 0;
  const canRun = teacher ? canTeachCourse(teacher, course) : false;

  const enrolledIds = new Set(enrolments.map(enrolment => enrolment.characterId));
  const enrolled = enrolments
    .map(enrolment => ({ enrolment, character: roster.find(char => char.id === enrolment.characterId) }))
    .filter((entry): entry is { enrolment: SchoolEnrolment; character: Character } => Boolean(entry.character));

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center gap-3">
        <GraduationCap className="w-7 h-7 text-amber-400" />
        <div>
          <h2 className="text-xl font-bold text-white">Школа</h2>
          <p className="text-sm text-slate-400">
            Развитие персонала: базовые и профессиональные курсы, обучение под руководством преподавателя.
          </p>
        </div>
      </div>

      <div className={CARD}>
        <h3 className="font-bold text-white mb-3">Преподаватель</h3>
        {teachers.length === 0 ? (
          <p className="text-sm text-slate-400">Нет доступных преподавателей. Назначьте сотрудника со специализацией «Учитель».</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-slate-300">
              Преподаватель
              <select className={`${CONTROL} mt-1 w-full`} value={teacherName} onChange={event => setTeacherName(event.target.value)}>
                {teachers.map(candidate => (
                  <option key={candidate.name} value={candidate.name}>{candidate.name} (навык {candidate.skill})</option>
                ))}
              </select>
            </label>
            <div className="text-sm text-slate-300 space-y-1">
              <p>Качество преподавания: <span className="text-amber-400 font-semibold">{quality}/100</span></p>
              <p>Предел ученика: <span className="text-emerald-400 font-semibold">{cap}</span> (90% уровня преподавателя)</p>
              <p>Курс доступен: <span className={canRun ? 'text-emerald-400' : 'text-rose-400'}>{canRun ? 'да' : 'нет'}</span></p>
            </div>
          </div>
        )}
      </div>

      <div className={CARD}>
        <h3 className="font-bold text-white mb-3">Курсы</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {SCHOOL_COURSES.map(definition => {
            const affordable = teacher ? canTeachCourse(teacher, definition) : false;
            return (
              <div key={definition.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-white">{definition.name}</h4>
                  <span className="text-xs font-mono text-slate-400">{definition.durationWeeks} нед.</span>
                </div>
                <p className="text-xs text-slate-400">{definition.shortDescription}</p>
                <div className="text-xs text-slate-300 font-mono space-y-0.5">
                  <p>Взнос: {definition.weeklyFee} AX/нед.</p>
                  {definition.weeklyIncome > 0 && <p>Доход центра: {definition.weeklyIncome} AX/нед.</p>}
                  {definition.skillReward > 0 && <p>Навык за курс: +{definition.skillReward}</p>}
                  {definition.submissionReward > 0 && <p>Покорность за курс: +{definition.submissionReward}</p>}
                  <p>Мин. уровень преподавателя: {definition.minTeacherLevel}</p>
                </div>
                <p className={`text-xs font-semibold ${affordable ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {affordable ? 'Можно вести' : 'Преподаватель недостаточно квалифицирован'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className={CARD}>
        <h3 className="font-bold text-white mb-3">Запись на курс</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block text-sm text-slate-300">
            Курс
            <select className={`${CONTROL} mt-1 w-full`} value={courseId} onChange={event => setCourseId(event.target.value as SchoolCourseId)}>
              {SCHOOL_COURSES.map(definition => (
                <option key={definition.id} value={definition.id}>{definition.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 space-y-2 max-h-72 overflow-y-auto">
          {roster.map(character => {
            const isEnrolled = enrolledIds.has(character.id);
            const atCap = character.skill >= cap;
            return (
              <div key={character.id} className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-slate-500" />
                  <span className="text-white font-medium">{character.name}</span>
                  <span className="text-xs text-slate-400 font-mono">навык {character.skill}</span>
                  {character.trainedAtEmporium && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300">Обучен в Эмпориуме</span>}
                </div>
                {isEnrolled ? (
                  <button className="text-xs text-rose-400 hover:underline" onClick={() => onCancel(character.id)}>Отменить</button>
                ) : (
                  <button
                    className="text-xs text-amber-400 hover:underline disabled:text-slate-600 disabled:no-underline"
                    disabled={!canRun || atCap}
                    title={atCap ? 'Навык уже на пределе уровня преподавателя' : undefined}
                    onClick={() => onEnroll(character.id, courseId)}
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
        <h3 className="font-bold text-white mb-3">Обучаются сейчас ({enrolled.length})</h3>
        {enrolled.length === 0 ? (
          <p className="text-sm text-slate-400">Пока никто не записан.</p>
        ) : (
          <div className="space-y-2">
            {enrolled.map(({ enrolment, character }) => {
              const definition = SCHOOL_COURSE_BY_ID[enrolment.courseId];
              const progress = Math.round((enrolment.weeksAttended / definition.durationWeeks) * 100);
              return (
                <div key={enrolment.characterId} className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white font-medium">{character.name}</span>
                    <span className="text-xs text-slate-400">{definition.name}</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500" style={{ width: `${progress}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 font-mono">
                    {enrolment.weeksAttended}/{definition.durationWeeks} нед. · начат на неделе {enrolment.startedWeek} (текущая {week})
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
