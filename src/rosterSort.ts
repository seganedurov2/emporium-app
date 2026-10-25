/**
 * Единая сортировка ростера персонала — та же, что и во вкладке
 * «Дом удовольствия» (App.tsx). Порядок опций, направления по
 * умолчанию и алгоритм (ключ → имя) одинаковы везде: салон,
 * стрип-клуб, охрана, отдел кадров и т.д. используют этот модуль.
 *
 * Порядок полей в селекторе:
 *   none → value → pregnancy → health → earnings → purchase
 *        → name → gender → age → exhaustion → idle
 */

import { marketValueOf } from './slaveContractsEngine';
import type { Character } from './gameEngine';

export type RosterSortId =
  | 'none'
  | 'name'
  | 'age'
  | 'gender'
  | 'health'
  | 'exhaustion'
  | 'earnings'
  | 'pregnancy'
  | 'idle'
  | 'purchase'
  | 'value';

export interface RosterSortOption {
  id: RosterSortId;
  label: string;
  descending: boolean;
}

/** Порядок групп при сортировке по полу: женщины, мужчины, трансгендеры. */
export const GENDER_SORT_ORDER: readonly ['women', 'men', 'trans'] = ['women', 'men', 'trans'];

const genderSortRank = (gender: string): number => {
  const index = GENDER_SORT_ORDER.indexOf(gender as 'women' | 'men' | 'trans');
  return index === -1 ? GENDER_SORT_ORDER.length : index;
};

/** Порядок опций в селекторе; `descending` — начальное направление. */
export const ROSTER_SORT_OPTIONS: RosterSortOption[] = [
  { id: 'none', label: 'Без сортировки', descending: false },
  { id: 'value', label: 'Стоимость на рынке', descending: true },
  { id: 'pregnancy', label: 'Беременность', descending: true },
  { id: 'health', label: 'Здоровье', descending: true },
  { id: 'earnings', label: 'Заработок', descending: true },
  { id: 'purchase', label: 'Неделя покупки', descending: true },
  { id: 'name', label: 'Имя по алфавиту', descending: false },
  { id: 'gender', label: 'Пол', descending: false },
  { id: 'age', label: 'Возраст', descending: false },
  { id: 'exhaustion', label: 'Усталость', descending: true },
  { id: 'idle', label: 'Без работы', descending: true }
];

export const rosterSortById = (id: RosterSortId): RosterSortOption =>
  ROSTER_SORT_OPTIONS.find(option => option.id === id) ?? ROSTER_SORT_OPTIONS[0];

/** true, если персонал занят на какой-либо площадке (не «без работы»). */
export const worksVenue = (venue: string | undefined): boolean =>
  Boolean(venue) && venue !== 'unassigned';

/**
 * Числовой ключ сортировки для персонажей (пленники/сотрудники ростера).
 * Для «беременность» — срок беременности (ближе к родам — выше),
 * для «без работы» — флаг отсутствия назначения (такие остаются
 * наверху при убывании), для «неделя покупки» — неделя присоединения
 * к компании (свежие покупки выше при убывании), для «стоимость на
 * рынке» — оценка персонала на премиальном рынке сбыта, для «пол» —
 * ранг гендерной группы (женщины, мужчины, трансгендеры).
 */
export const rosterSortValue = (char: Character, mode: RosterSortId): number => {
  switch (mode) {
    case 'age':
      return char.age;
    case 'gender':
      return genderSortRank(char.gender);
    case 'health':
      return char.exactHealth;
    case 'exhaustion':
      return char.exactExhaustion;
    case 'earnings':
      return char.pleasureStats?.totalEarnings ?? 0;
    case 'pregnancy':
      return char.pregnancy ? char.pregnancy.daysPregnant : -1;
    case 'idle':
      return worksVenue(char.assignedVenue) ? 0 : 1;
    case 'purchase':
      return char.acquiredWeek ?? 0;
    case 'value':
      return marketValueOf(char);
    default:
      return 0;
  }
};

/**
 * Стабильная сортировка любого ростера: сначала по ключу режима,
 * затем по имени (как в «Доме удовольствия»). `getSortValue`
 * реализуется на каждый тип ростера (персонажи, сотрудники).
 */
export const sortRoster = <T extends { name: string }>(
  roster: T[],
  mode: RosterSortId,
  descending: boolean,
  getSortValue: (item: T, mode: RosterSortId) => number
): T[] => {
  if (mode === 'none') return roster;
  const direction = descending ? -1 : 1;
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, 'ru');
  if (mode === 'name') return [...roster].sort((a, b) => direction * byName(a, b));
  return [...roster].sort((a, b) =>
    direction * (getSortValue(a, mode) - getSortValue(b, mode)) || byName(a, b)
  );
};

/** Ключ сортировки для персонажей — готов к использованию везде. */
export const characterSortValue = (char: Character, mode: RosterSortId): number =>
  rosterSortValue(char, mode);

/** Кнопка переключения направления сортировки — одинаковый интерфейс везде. */
export const ROSTER_SORT_CONTROL_LABEL = 'Сменить направление сортировки';