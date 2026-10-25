/**
 * School — training courses run by an assigned teacher.
 *
 * Four tracks exist:
 *   • Basic        — lifts the character's core skill, grants «Trained at Emporium».
 *   • Vocational   — deeper specialisation; the trainee's skill caps at 90% of the teacher's.
 *   • Dispositional— raises submission and loyalty rather than raw skill.
 *   • Commercial   — the trainee earns money while learning; the only paid track.
 *
 * Teaching quality blends the teacher's Teaching skill (50%), Charisma (25%) and
 * Intelligence (25%). Students never surpass 90% of their teacher's level, so a
 * weak teacher caps the whole group.
 *
 * Pure module: callers pass the roster and the assigned teacher, and receive the
 * updated roster plus weekly log lines.
 */

import type { Character } from './gameEngine';

export type SchoolCourseId = 'basic' | 'vocational' | 'dispositional' | 'commercial';

export interface SchoolCourseDefinition {
  id: SchoolCourseId;
  name: string;
  shortDescription: string;
  /** Campaign weeks a trainee must attend before the course completes. */
  durationWeeks: number;
  /** Weekly fee charged per enrolled student. */
  weeklyFee: number;
  /** Core-skill points awarded per completed course. */
  skillReward: number;
  /** Submission points awarded per completed course. */
  submissionReward: number;
  /** Weekly income per student on the Commercial track. */
  weeklyIncome: number;
  /** Whether completing the course grants the «Trained at Emporium» marker. */
  grantsTrainedStatus: boolean;
  /** Minimum teacher level required to run the course. */
  minTeacherLevel: number;
}

export const SCHOOL_COURSES: SchoolCourseDefinition[] = [
  {
    id: 'basic',
    name: 'Базовый курс',
    shortDescription: 'Общая подготовка: поднимает базовый навык и выдаёт статус «Обучен в Эмпориуме».',
    durationWeeks: 4,
    weeklyFee: 350,
    skillReward: 8,
    submissionReward: 0,
    weeklyIncome: 0,
    grantsTrainedStatus: true,
    minTeacherLevel: 20
  },
  {
    id: 'vocational',
    name: 'Профессиональный курс',
    shortDescription: 'Углублённая специализация. Уровень ученика не превысит 90% уровня преподавателя.',
    durationWeeks: 6,
    weeklyFee: 520,
    skillReward: 14,
    submissionReward: 0,
    weeklyIncome: 0,
    grantsTrainedStatus: true,
    minTeacherLevel: 40
  },
  {
    id: 'dispositional',
    name: 'Курс дисциплины',
    shortDescription: 'Работа с характером: растёт покорность и лояльность, а не навык.',
    durationWeeks: 3,
    weeklyFee: 280,
    skillReward: 0,
    submissionReward: 12,
    weeklyIncome: 0,
    grantsTrainedStatus: false,
    minTeacherLevel: 25
  },
  {
    id: 'commercial',
    name: 'Коммерческий курс',
    shortDescription: 'Обучение с отработкой: ученик приносит небольшой доход, пока учится.',
    durationWeeks: 4,
    weeklyFee: 0,
    skillReward: 6,
    submissionReward: 4,
    weeklyIncome: 260,
    grantsTrainedStatus: true,
    minTeacherLevel: 30
  }
];

export const SCHOOL_COURSE_BY_ID: Record<SchoolCourseId, SchoolCourseDefinition> =
  SCHOOL_COURSES.reduce((acc, course) => {
    acc[course.id] = course;
    return acc;
  }, {} as Record<SchoolCourseId, SchoolCourseDefinition>);

/** Weight of each teacher stat in the teaching-quality blend. */
export const TEACHING_QUALITY_WEIGHTS = {
  teaching: 0.5,
  charisma: 0.25,
  intelligence: 0.25
} as const;

/** Students can never exceed this fraction of the teacher's skill. */
export const STUDENT_SKILL_CAP_RATIO = 0.9;

/** A trainee's attendance record for one course. */
export interface SchoolEnrolment {
  characterId: string;
  courseId: SchoolCourseId;
  /** Weeks attended so far. */
  weeksAttended: number;
  /** Week the enrolment started. */
  startedWeek: number;
}

/**
 * The slice of a teacher the school cares about. Kept structural so the engine
 * works with both roster characters and hired employees.
 */
export interface TeacherProfile {
  name: string;
  /** Core aptitude — used to cap the students' level. */
  skill: number;
  /** 0-100; the dominant factor in teaching quality. */
  teachingSkill?: number;
  /** 0-100; how engaging the lessons land. */
  charisma?: number;
  /** 0-100; how clearly the material is structured. */
  intelligence?: number;
}

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value));

/** The teaching stat used when the character has no explicit value yet. */
export const teachingStatOf = (teacher: Pick<TeacherProfile, 'skill' | 'teachingSkill'>): number =>
  teacher.teachingSkill ?? Math.round(teacher.skill * 0.6);

/** The charisma stat, defaulting to a neutral 50 for characters without one. */
export const charismaStatOf = (teacher: Pick<TeacherProfile, 'charisma'>): number =>
  teacher.charisma ?? 50;

/** The intelligence stat, defaulting to a neutral 50 for characters without one. */
export const intelligenceStatOf = (teacher: Pick<TeacherProfile, 'intelligence'>): number =>
  teacher.intelligence ?? 50;

/**
 * Weighted teaching quality: Teaching 50%, Charisma 25%, Intelligence 25%.
 * Returns 0-100.
 */
export function teachingQuality(teacher: TeacherProfile): number {
  const quality =
    teachingStatOf(teacher) * TEACHING_QUALITY_WEIGHTS.teaching +
    charismaStatOf(teacher) * TEACHING_QUALITY_WEIGHTS.charisma +
    intelligenceStatOf(teacher) * TEACHING_QUALITY_WEIGHTS.intelligence;
  return clamp(Math.round(quality));
}

/**
 * Highest core-skill a student can reach under this teacher — 90% of the
 * teacher's own skill, never below 1.
 */
export function studentSkillCap(teacher: Pick<TeacherProfile, 'skill'>): number {
  return Math.max(1, Math.floor(teacher.skill * STUDENT_SKILL_CAP_RATIO));
}

/** Whether the teacher is qualified to run a given course. */
export function canTeachCourse(teacher: TeacherProfile, course: SchoolCourseDefinition): boolean {
  return teachingStatOf(teacher) >= course.minTeacherLevel;
}

export interface SchoolTickOptions {
  roster: Character[];
  enrolments: SchoolEnrolment[];
  teacher: TeacherProfile | null;
  week: number;
  random?: () => number;
}

export interface SchoolTickResult {
  roster: Character[];
  enrolments: SchoolEnrolment[];
  /** Students who finished their course this week. */
  graduates: string[];
  /** Weekly course fees collected from students (income is reported separately). */
  feesCollected: number;
  /** Weekly income from the Commercial track. */
  commercialIncome: number;
  log: string[];
}

/**
 * Advances the school one week. Enrolled students progress toward their course;
 * those who finish receive the skill/submission rewards and the
 * «Trained at Emporium» marker. Enrolments whose character left the roster are
 * dropped silently.
 */
export function tickSchool(options: SchoolTickOptions): SchoolTickResult {
  const { roster, teacher } = options;
  const enrolments: SchoolEnrolment[] = [];
  const graduates: string[] = [];
  const log: string[] = [];
  let feesCollected = 0;
  let commercialIncome = 0;

  const byId = new Map(roster.map(character => [character.id, character]));
  const next = new Map(roster.map(character => [character.id, character]));

  for (const enrolment of options.enrolments) {
    const character = byId.get(enrolment.characterId);
    if (!character) continue;

    const course = SCHOOL_COURSE_BY_ID[enrolment.courseId];
    if (!course) continue;

    // A wounded or critically unwell student cannot attend class this week.
    const incapacitated = (character.wounds?.length ?? 0) > 0 || (character.exactHealth ?? 100) <= 30;
    if (incapacitated) {
      enrolments.push(enrolment);
      continue;
    }

    feesCollected += course.weeklyFee;
    commercialIncome += course.weeklyIncome;

    const weeksAttended = enrolment.weeksAttended + 1;
    if (weeksAttended < course.durationWeeks) {
      enrolments.push({ ...enrolment, weeksAttended });
      continue;
    }

    // Course complete — apply the rewards, respecting the teacher's skill cap.
    const quality = teacher ? teachingQuality(teacher) : 40;
    const qualityFactor = 0.5 + quality / 100; // 0.5× at zero quality, 1.5× at full
    const cap = teacher ? studentSkillCap(teacher) : 60;

    const currentSkill = character.skill ?? 50;
    const gained = Math.round(course.skillReward * qualityFactor);
    const targetSkill = Math.min(cap, currentSkill + gained);
    const skill = Math.max(currentSkill, targetSkill);

    const submission = clamp((character.submission ?? 50) + course.submissionReward);
    const loyalty = clamp((character.loyalty ?? 50) + Math.round(course.submissionReward / 2));

    const updated: Character = {
      ...character,
      skill,
      submission,
      loyalty,
      ...(course.grantsTrainedStatus ? { trainedAtEmporium: true } : {})
    };
    next.set(character.id, updated);
    graduates.push(character.name);

    const parts = [`${character.name} завершил(а) «${course.name}»`];
    if (skill > currentSkill) parts.push(`навык ${currentSkill} → ${skill}`);
    if (course.submissionReward > 0) parts.push(`покорность +${course.submissionReward}`);
    if (course.grantsTrainedStatus) parts.push('статус «Обучен в Эмпориуме»');
    log.push(`${parts.join(', ')}.`);
  }

  return {
    roster: roster.map(character => next.get(character.id) ?? character),
    enrolments,
    graduates,
    feesCollected,
    commercialIncome,
    log
  };
}

/** Enrols a character into a course, replacing any earlier enrolment for them. */
export function enrollStudent(
  enrolments: SchoolEnrolment[],
  characterId: string,
  courseId: SchoolCourseId,
  week: number
): SchoolEnrolment[] {
  return [
    ...enrolments.filter(enrolment => enrolment.characterId !== characterId),
    { characterId, courseId, weeksAttended: 0, startedWeek: week }
  ];
}

/** Removes a character's enrolment. */
export function cancelEnrolment(enrolments: SchoolEnrolment[], characterId: string): SchoolEnrolment[] {
  return enrolments.filter(enrolment => enrolment.characterId !== characterId);
}
