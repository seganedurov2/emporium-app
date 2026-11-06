import type { Character } from "./gameEngine";

/**
 * Constants of the weekly cycle. They used to live at the top of App.tsx; the
 * cycle itself moved to campaignWeek.ts, so the labels and the off-duty
 * recovery moved here with it.
 */

export const OFF_DUTY_EXHAUSTION_RECOVERY = 8;

export const EXHAUSTION_LABELS: Record<Character["exhaustionLevel"], string> = {
  Rested: "Отдохнувший",
  Tired: "Уставший",
  Exhausted: "Истощён",
  "Burned Out": "Выгоревший",
};

export const HEALTH_LABELS: Record<Character["healthLevel"], string> = {
  Pristine: "Отличное",
  Good: "Хорошее",
  Fair: "Среднее",
  Poor: "Плохое",
  Critical: "Критическое",
};
