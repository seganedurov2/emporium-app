/** Возраст иждивенца в человекочитаемом виде: дни, недели, годы и месяцы. */
export function formatDependentAge(ageDays: number): string {
  if (ageDays < 7) return `${ageDays} ${ageDays === 1 ? 'день' : 'дней'}`;
  if (ageDays < 365) {
    const weeks = Math.floor(ageDays / 7);
    return `${weeks} ${weeks === 1 ? 'неделя' : 'недель'}`;
  }
  const years = Math.floor(ageDays / 365);
  const months = Math.floor((ageDays % 365) / 30);
  return months > 0 ? `${years} г. ${months} мес.` : `${years} ${years === 1 ? 'год' : 'года'}`;
}
