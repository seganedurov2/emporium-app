/**
 * Correction Centre — obedience conditioning courses that raise Fear and,
 * past a threshold, convert that fear into permanent Assimilation.
 *
 * Three intensities exist (Standard 80 / Enhanced 90 / Intensive 100) and the
 * centre runs **open groups** — unlike the School, students join and leave freely
 * and are not capped by a teacher's skill. The centre never kills: any trainee
 * whose wounds would prove life-threatening is sent to the Hospital instead, and
 * an automatic medic posted on site treats course-related injuries.
 *
 * Pure module: callers pass the roster and receive the updated roster, the wound
 * outcomes, and log lines.
 */

import type { Character } from './gameEngine';
import { applyWound, type Wound } from './woundEngine';

export type CorrectionCourseId = 'adaptation' | 'commercial_discipline';

/** Fear above this value converts into Assimilation instead of staying fear. */
export const FEAR_TO_ASSIMILATION_THRESHOLD = 70;

/** Share of the excess fear converted into assimilation each week. */
export const ASSIMILATION_CONVERSION_RATE = 0.5;

export interface CorrectionCourseDefinition {
  id: CorrectionCourseId;
  name: string;
  shortDescription: string;
  /** Fear target this course drives the trainee toward. */
  fearTarget: number;
  /** Campaign weeks a trainee must attend. */
  durationWeeks: number;
  /** Weekly fee per trainee. */
  weeklyFee: number;
  /** Erotic skills developed by the course (the adaptation course lists three). */
  developsSkills: string[];
  /** Whether completing the course grants «Trained at Emporium». */
  grantsTrainedStatus: boolean;
  /** Weekly income per trainee, for the commercial track. */
  weeklyIncome: number;
  /** Chance per trainee per week of receiving a course-related wound. */
  injuryChance: number;
  /** Minimum fear a trainee needs before the course can start. */
  minFear: number;
}

export const CORRECTION_COURSES: CorrectionCourseDefinition[] = [
  {
    id: 'adaptation',
    name: 'Курс адаптации',
    shortDescription:
      'Шесть недель перевоспитания: растёт страх, развиваются три эротических навыка, по завершении — статус «Обучен в Эмпориуме».',
    fearTarget: 80,
    durationWeeks: 6,
    weeklyFee: 420,
    developsSkills: ['Обслуживание', 'Покорность', 'Выносливость'],
    grantsTrainedStatus: true,
    weeklyIncome: 0,
    injuryChance: 0.22,
    minFear: 10
  },
  {
    id: 'commercial_discipline',
    name: 'Коммерческая дисциплина',
    shortDescription: 'Платный курс дрессировки: страх растёт, а центр получает доход с каждого ученика.',
    fearTarget: 90,
    durationWeeks: 4,
    weeklyFee: 0,
    developsSkills: ['Обслуживание', 'Дисциплина'],
    grantsTrainedStatus: false,
    weeklyIncome: 340,
    injuryChance: 0.28,
    minFear: 25
  }
];

export const CORRECTION_COURSE_BY_ID: Record<CorrectionCourseId, CorrectionCourseDefinition> =
  CORRECTION_COURSES.reduce((acc, course) => {
    acc[course.id] = course;
    return acc;
  }, {} as Record<CorrectionCourseId, CorrectionCourseDefinition>);

/** Fear intensity presets — Standard 80, Enhanced 90, Intensive 100. */
export type CorrectionIntensity = 'standard' | 'enhanced' | 'intensive';

export const CORRECTION_INTENSITY_TARGETS: Record<CorrectionIntensity, number> = {
  standard: 80,
  enhanced: 90,
  intensive: 100
};

export const CORRECTION_INTENSITY_LABELS: Record<CorrectionIntensity, string> = {
  standard: 'Стандартная (цель 80)',
  enhanced: 'Усиленная (цель 90)',
  intensive: 'Интенсивная (цель 100)'
};

/** Fear a course-related wound would push the trainee past — hospitalises them instead. */
export const FEAR_HOSPITAL_THRESHOLD = 95;

/** Fear gained each week on a course, scaled by intensity. */
const FEAR_GAIN_BY_INTENSITY: Record<CorrectionIntensity, number> = {
  standard: 6,
  enhanced: 9,
  intensive: 13
};

export interface CorrectionEnrolment {
  characterId: string;
  courseId: CorrectionCourseId;
  intensity: CorrectionIntensity;
  weeksAttended: number;
  startedWeek: number;
  /** Set when a wound forced the trainee into the Hospital; they stop attending. */
  hospitalised?: boolean;
}

const clamp = (value: number, min = 0, max = 100): number => Math.max(min, Math.min(max, value));

/**
 * Fear gain for one week on a course. Higher intensity and lower current fear
 * both increase the gain, so conditioning slows as the trainee nears the target.
 */
export function weeklyFearGain(intensity: CorrectionIntensity, currentFear: number): number {
  const base = FEAR_GAIN_BY_INTENSITY[intensity];
  const resistance = currentFear / 100;
  return Math.max(1, Math.round(base * (1.25 - resistance * 0.5)));
}

/**
 * Converts fear above the threshold into assimilation. Returns the new fear and
 * assimilation values plus how much was converted.
 */
export function convertFear(
  fear: number,
  assimilation: number
): { fear: number; assimilation: number; converted: number } {
  if (fear <= FEAR_TO_ASSIMILATION_THRESHOLD) {
    return { fear, assimilation, converted: 0 };
  }
  const excess = fear - FEAR_TO_ASSIMILATION_THRESHOLD;
  const converted = Math.round(excess * ASSIMILATION_CONVERSION_RATE);
  return {
    fear: clamp(fear - converted),
    assimilation: clamp(assimilation + converted),
    converted
  };
}

export interface CorrectionTickOptions {
  roster: Character[];
  enrolments: CorrectionEnrolment[];
  week: number;
  /** Whether the centre's automatic medic is posted; halves wound severity. */
  hasMedic?: boolean;
  random?: () => number;
}

export interface CorrectionTickResult {
  roster: Character[];
  enrolments: CorrectionEnrolment[];
  /** Trainees sent to the Hospital with life-threatening wounds. */
  hospitalised: string[];
  /** Trainees who completed their course this week. */
  graduates: string[];
  feesCollected: number;
  commercialIncome: number;
  log: string[];
}

/**
 * Advances the Correction Centre one week. Every trainee gains fear; fear past
 * the threshold turns into assimilation. Injuries are rolled per trainee — the
 * on-site medic softens them, and any wound that would prove fatal sends the
 * trainee to the Hospital instead of the morgue.
 */
export function tickCorrectionCentre(options: CorrectionTickOptions): CorrectionTickResult {
  const { roster, week } = options;
  const random = options.random ?? Math.random;
  const enrolments: CorrectionEnrolment[] = [];
  const hospitalised: string[] = [];
  const graduates: string[] = [];
  const log: string[] = [];
  let feesCollected = 0;
  let commercialIncome = 0;

  const next = new Map(roster.map(character => [character.id, character]));

  for (const enrolment of options.enrolments) {
    const character = next.get(enrolment.characterId);
    if (!character) continue;

    const course = CORRECTION_COURSE_BY_ID[enrolment.courseId];
    if (!course) continue;

    if (enrolment.hospitalised) {
      enrolments.push(enrolment);
      continue;
    }

    feesCollected += course.weeklyFee;
    commercialIncome += course.weeklyIncome;

    // Fear rises toward the course target, then converts to assimilation.
    const fear = clamp((character.fear ?? 0) + weeklyFearGain(enrolment.intensity, character.fear ?? 0));
    const conversion = convertFear(fear, character.assimilation ?? 0);

    let updated: Character = {
      ...character,
      fear: conversion.fear,
      assimilation: conversion.assimilation,
      submission: clamp((character.submission ?? 50) + 2)
    };

    // Injuries: the medic halves severity, a lethal wound sends them to Hospital.
    if (random() < course.injuryChance) {
      const baseSeverity = 20 + Math.round(random() * 55);
      const severity = options.hasMedic ? Math.round(baseSeverity * 0.5) : baseSeverity;
      const woundResult = applyWound(updated, { severity, week, random });
      if (woundResult.fatal) {
        // The centre cannot kill — route the trainee to the Hospital instead.
        updated = {
          ...updated,
          healthLevel: 'Critical',
          exactHealth: Math.min(updated.exactHealth ?? 40, 12)
        };
        next.set(character.id, updated);
        enrolments.push({ ...enrolment, hospitalised: true });
        hospitalised.push(character.name);
        log.push(
          `${character.name} получил(а) опасное для жизни ранение на «${course.name}» — автоматический медик стабилизировал и отправил в Больницу.`
        );
        continue;
      }
      updated = woundResult.character;
      log.push(`На «${course.name}»: ${woundResult.log}${options.hasMedic ? ' Медик обработал травму.' : ''}`);
    }

    const weeksAttended = enrolment.weeksAttended + 1;
    if (weeksAttended < course.durationWeeks) {
      next.set(character.id, updated);
      enrolments.push({ ...enrolment, weeksAttended });
      continue;
    }

    // Course complete.
    updated = {
      ...updated,
      ...(course.grantsTrainedStatus ? { trainedAtEmporium: true } : {}),
      submission: clamp((updated.submission ?? 50) + 8)
    };
    next.set(character.id, updated);
    graduates.push(character.name);
    const skillNote = course.developsSkills.length > 0 ? `, развиты навыки: ${course.developsSkills.join(', ')}` : '';
    log.push(
      `${character.name} завершил(а) «${course.name}»: страх ${Math.round(conversion.fear)}, ассимиляция ${Math.round(conversion.assimilation)}${skillNote}.`
    );
  }

  return {
    roster: roster.map(character => next.get(character.id) ?? character),
    enrolments,
    hospitalised,
    graduates,
    feesCollected,
    commercialIncome,
    log
  };
}

/** Enrols a character into a correction course, replacing any earlier enrolment. */
export function enrollInCorrection(
  enrolments: CorrectionEnrolment[],
  characterId: string,
  courseId: CorrectionCourseId,
  intensity: CorrectionIntensity,
  week: number
): CorrectionEnrolment[] {
  return [
    ...enrolments.filter(enrolment => enrolment.characterId !== characterId),
    { characterId, courseId, intensity, weeksAttended: 0, startedWeek: week }
  ];
}

/** Removes a character's correction enrolment. */
export function cancelCorrectionEnrolment(
  enrolments: CorrectionEnrolment[],
  characterId: string
): CorrectionEnrolment[] {
  return enrolments.filter(enrolment => enrolment.characterId !== characterId);
}

/** Wound carrying over from a correction course, for display in the UI. */
export type CourseWound = Wound;
