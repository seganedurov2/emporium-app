import { FIRST_NAMES, LAST_NAMES, REGIONS, type Character, type Dependent } from './gameEngine';
import { formatMoney } from './currency';

export interface PrisonerChatMessage {
  id: string;
  from: 'player' | 'ai';
  text: string;
}

function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pickFrom = <T,>(rng: () => number, pool: T[]): T => pool[Math.floor(rng() * pool.length)];

interface Pronouns {
  subject: string;
  object: string;
}

function pronounsFor(gender: Character['gender']): Pronouns {
  if (gender === 'women') return { subject: 'она', object: 'её' };
  if (gender === 'men') return { subject: 'он', object: 'его' };
  return { subject: 'они', object: 'их' };
}

/** Окончание глагола прошедшего времени: была/был/были. */
function verbEndFor(gender: Character['gender']): string {
  if (gender === 'women') return 'а';
  if (gender === 'men') return '';
  return 'и';
}

const OCCUPATIONS: Record<Character['gender'], Record<'low' | 'mid' | 'high' | 'elite', string[]>> = {
  women: {
    low: ['деревенская девушка', 'служанка', 'подёнщица', 'сельская труженица'],
    mid: ['торговка на базаре', 'ученица ремесленника', 'сельская учительница', 'помощница аптекаря'],
    high: ['купчиха', 'офицер гарнизона', 'учёная', 'наставница при дворе'],
    elite: ['знатная особа', 'военачальница', 'придворная советница']
  },
  men: {
    low: ['подёнщик', 'сельский работник', 'пастух', 'слуги'],
    mid: ['ремесленник', 'торговец', 'наёмный стражник', 'погонщик каравана'],
    high: ['офицер гарнизона', 'учёный', 'купец', 'картограф'],
    elite: ['знатный вельможа', 'военачальник', 'придворный советник', 'капитан дальнего плавания']
  },
  trans: {
    low: ['подёнщик', 'сельский работник', 'пастух', 'слуги'],
    mid: ['ремесленник', 'торговец', 'наёмный стражник', 'погонщик каравана'],
    high: ['офицер гарнизона', 'учёный', 'купец', 'картограф'],
    elite: ['знатный вельможа', 'военачальник', 'придворный советник', 'капитан дальнего плавания']
  }
};

function formerOccupation(rng: () => number, char: Character): string {
  const skill = char.skill ?? 30;
  const tier = skill >= 85 ? 'elite' : skill >= 60 ? 'high' : skill >= 30 ? 'mid' : 'low';
  return pickFrom(rng, OCCUPATIONS[char.gender][tier]);
}

/** Человекочитаемая подпись источника захвата для реестра и чата. */
export function slaveOriginLabel(origin: string | undefined): string {
  if (!origin) return 'Неизвестно';
  const [kind, arg] = origin.split(':');
  const regionName = arg ? (REGIONS.find(region => region.id === arg)?.name ?? arg) : '';
  switch (kind) {
    case 'caravan_raid': return 'Налёт на караван';
    case 'capture_op': return 'Операция по захвату';
    case 'slave_auction': return 'Невольничий аукцион';
    case 'market_purchase': return `Рынок пленных лотов (${regionName})`;
    case 'global_market': return 'Глобальный рынок';
    case 'supply_contract': return `Контракт поставок (${regionName})`;
    case 'supply_contract_completion': return 'Награда за контракт поставок';
    case 'caravan_completion': return 'Завершение караванного рейса';
    case 'birth': return 'Рождён(а) в плену';
    default: return origin;
  }
}

function captureParagraph(rng: () => number, char: Character, ve: string): string {
  const origin = char.slaveOrigin ?? '';
  const [kind, arg] = origin.split(':');
  const regionName = arg ? (REGIONS.find(region => region.id === arg)?.name ?? arg) : char.regionName;
  switch (kind) {
    case 'caravan_raid':
      return pickFrom(rng, [
        `Дорога выдалась злой: караван, в котором находил${ve === 'и' ? 'ись' : 'ся'} ${char.name}, попал в засаду на горном перевале — налёт сорвал рейс и превратил пассажиров в добычу.`,
        `Налёт на торговый караван — так в руки синдиката попал${ve} ${char.name}.`
      ]);
    case 'capture_op':
      return `Спецотряд синдиката вычислил ${char.name} по данным разведки и провёл операцию по захвату в регионе ${regionName}.`;
    case 'slave_auction':
      return pickFrom(rng, [
        `${char.name} выставил${ve} на невольничий аукцион — лот ушёл с молотка тому, кто предложил лучшую цену.`,
        `Невольничий аукцион: ${char.name} был${ve} продан${ve} с молотка и передан${ve} новому владельцу.`
      ]);
    case 'market_purchase':
      return `На рынке пленных лотов в регионе ${regionName} ${char.name} оценили по характеристикам и продали${ve} синдикату.`;
    case 'global_market':
      return `Через глобальный рынок ${char.name} попал${ve} в каталог синдиката и был${ve} выкуплен${ve} казной.`;
    case 'supply_contract':
      return `Поставщик по контракту доставил ${char.name} прямо на склад синдиката — регион поставки: ${regionName}.`;
    case 'supply_contract_completion':
      return `По завершении контракта поставок ${char.name} передали синдикату как награду за выполнение условий (${regionName}).`;
    case 'caravan_completion':
      return `Караван, в котором находил${ve === 'и' ? 'ись' : 'ся'} ${char.name}, завершил рейс — вся добыча перешла в собственность синдиката.`;
    case 'birth':
      return `${char.name} родил${ve}ся уже в плену — единственный мир, который ${pronounsFor(char.gender).subject} зна${ve === 'и' ? 'ют' : 'ет'}, это стены синдиката.`;
    default:
      return pickFrom(rng, [
        `Как именно ${char.name} оказал${ve}ся на рынке, синдикат не фиксировал — в реестре значится только регион: ${regionName}.`,
        `История пути ${char.name} на рынок осталась в тени: известно лишь, что в регионе ${regionName} ${pronounsFor(char.gender).subject} попал${ve} в плен.`
      ]);
  }
}

export interface PersonalityTrait {
  id: string;
  name: string;
  /** Краткая характеристика придаточным предложением (без точки в конце). */
  description: string;
}

export const PERSONALITY_TRAITS: PersonalityTrait[] = [
  { id: 'pt_stoic', name: 'Стоик', description: 'не выдаёт эмоций и принимает удары судьбы молча' },
  { id: 'pt_defiant', name: 'Бунтарь', description: 'внутренне сопротивляется и не признаёт власть синдиката' },
  { id: 'pt_meek', name: 'Покорный', description: 'избегает конфликтов и подчиняется первому приказу' },
  { id: 'pt_cunning', name: 'Хитрец', description: 'умеет выкручиваться и находить выгодный угол' },
  { id: 'pt_dreamer', name: 'Мечтатель', description: 'живёт воспоминаниями о родине и надеждой на свободу' },
  { id: 'pt_phlegmatic', name: 'Флегматик', description: 'ровный нрав, редко вспыхивает и не сдаётся панике' },
  { id: 'pt_hot_tempered', name: 'Вспыльчивый', description: 'быстро загорается, но так же быстро остывает' },
  { id: 'pt_sociable', name: 'Общительный', description: 'легко находит общий язык с любым человеком' },
  { id: 'pt_loner', name: 'Замкнутый', description: 'держится особняком и доверяет лишь немногим' },
  { id: 'pt_resilient', name: 'Живучий', description: 'выдерживает тяжёлые условия без жалоб' },
  { id: 'pt_anxious', name: 'Тревожный', description: 'постоянно ожидает неприятного и просчитывает риски' },
  { id: 'pt_proud', name: 'Гордец', description: 'хранит достоинство, даже будучи в плену' },
  { id: 'pt_pragmatist', name: 'Прагматик', description: 'быстро приспосабливается к новой реальности' },
  { id: 'pt_sentimental', name: 'Чувствительный', description: 'тоскует по близким и прежней жизни' },
  { id: 'pt_shrewd', name: 'Проницательный', description: 'читает людей и ситуации на лету' },
  { id: 'pt_stubborn', name: 'Упрямый', description: 'не меняет решений под давлением' },
  { id: 'pt_optimist', name: 'Оптимист', description: 'ищет светлую сторону даже в плену' },
  { id: 'pt_pessimist', name: 'Пессимист', description: 'ожидает худшего от каждого нового дня' },
  { id: 'pt_faithful', name: 'Верный', description: 'привязывается к тем, кто проявил силу и щедрость' },
  { id: 'pt_vindictive', name: 'Мстительный', description: 'не забывает обид и ждёт своего момента' }
];

/**
 * Детерминированные черты характера пленника: две уникальные черты,
 * выбранные по сиду от id персонажа. Один и тот же пленник всегда
 * получает один и тот же набор черт — как и остальные абзацы биографии.
 */
export function prisonerTraits(char: Character): PersonalityTrait[] {
  const rng = mulberry32(hashSeed(`${char.id}:traits`));
  const pool = [...PERSONALITY_TRAITS];
  const traits: PersonalityTrait[] = [];
  while (traits.length < 2 && pool.length > 0) {
    const index = Math.floor(rng() * pool.length);
    traits.push(pool.splice(index, 1)[0]);
  }
  return traits;
}

/** Строка «Стоик, Хитрец» для подписей, чата и карточек реестра. */
export function traitNamesText(char: Character): string {
  return prisonerTraits(char).map(trait => trait.name).join(', ');
}

/** Пленники реестра с заданной чертой характера — для каталога чатов по чертам. */
export function prisonersByTrait(roster: Character[], traitId: string): Character[] {
  return roster.filter(char => char.isSlave && prisonerTraits(char).some(trait => trait.id === traitId));
}

/** Абзац биографии: черты характера пленника. */
function traitsParagraph(char: Character): string {
  const traits = prisonerTraits(char);
  const names = traits.map(trait => trait.name.toLowerCase()).join(' и ');
  const details = traits.map(trait => trait.description).join('; ');
  return `Характер ${char.name} — ${names}: ${details}.`;
}

/** Абзацы биографии, целиком построенные вокруг одной черты характера. */
const TRAIT_BIOGRAPHY_LINES: Record<string, (char: Character, ve: string) => string> = {
  pt_stoic: (char, _ve) => `Стоик: ${char.name} принял${_ve} удары судьбы без единого слова — даже конвой не слышал жалоб.`,
  pt_defiant: (char, _ve) => `Бунтарь: внутри ${char.name} живёт сопротивление — синдикат так и не сломил${_ve} волю до конца.`,
  pt_meek: (char, _ve) => `Покорный: ${char.name} избегает конфликтов и подчиняется первому приказу — для надсмотрщиков идеальный лот.`,
  pt_cunning: (char, _ve) => `Хитрец: ${char.name} умеет выкручиваться — находит выгодный угол даже за колючей проволокой.`,
  pt_dreamer: (char, _ve) => `Мечтатель: ${char.name} живёт воспоминаниями о родине и надеждой на свободу — взгляд постоянно уходит за стены.`,
  pt_phlegmatic: (char, _ve) => `Флегматик: ровный нрав ${char.name} редко вспыхивает — паника проходит стороной.`,
  pt_hot_tempered: (char, _ve) => `Вспыльчивый: ${char.name} быстро загорается, но так же быстро остывает — искра гаснет за минуту.`,
  pt_sociable: (char, _ve) => `Общительный: ${char.name} легко находит общий язык с любым — от надсмотрщика до нового пленника.`,
  pt_loner: (char, _ve) => `Замкнутый: ${char.name} держится особняком и доверяет лишь немногим — доверие придётся заслужить.`,
  pt_resilient: (char, _ve) => `Живучий: ${char.name} выдерживает тяжёлые условия без жалоб — синдикат ценит таких.`,
  pt_anxious: (char, _ve) => `Тревожный: ${char.name} постоянно ожидает неприятного и просчитывает риски наперёд.`,
  pt_proud: (char, _ve) => `Гордец: ${char.name} хранит достоинство, даже будучи в плену — осанка выдаёт прежнюю жизнь.`,
  pt_pragmatist: (char, _ve) => `Прагматик: ${char.name} быстро приспосабливается к новой реальности — там, где другие ломаются, ${pronounsFor(char.gender).subject} подстраивается.`,
  pt_sentimental: (char, _ve) => `Чувствительный: ${char.name} тоскует по близким и прежней жизни — ночами шевелит губами.`,
  pt_shrewd: (char, _ve) => `Проницательный: ${char.name} читает людей и ситуации на лету — с ним лучше не играть в карты.`,
  pt_stubborn: (char, _ve) => `Упрямый: ${char.name} не меняет решений под давлением — сломать ${pronounsFor(char.gender).object} сложнее, чем остальных.`,
  pt_optimist: (char, _ve) => `Оптимист: ${char.name} ищет светлую сторону даже в плену — к настроению ${char.name} тянутся напарники.`,
  pt_pessimist: (char, _ve) => `Пессимист: ${char.name} ожидает худшего от каждого нового дня — надежды почти не осталось.`,
  pt_faithful: (char, _ve) => `Верный: ${char.name} привязывается к тем, кто проявил силу и щедрость — лояльность можно заслужить.`,
  pt_vindictive: (char, _ve) => `Мстительный: ${char.name} не забывает обид и ждёт своего момента — лучше не быть ${pronounsFor(char.gender).object} должником.`
};

/**
 * ИИ-биография пленника, построенная по чертам характера:
 * вступление и отдельный абзац на каждую черту.
 */
export function traitBiography(char: Character): string[] {
  const traits = prisonerTraits(char);
  const ve = verbEndFor(char.gender);
  const names = traits.map(trait => trait.name.toLowerCase()).join(' и ');
  const paragraphs = [
    `Характер ${char.name} — ${names}. Биография составлена ИИ из реестровых черт: каждый абзац — отдельная грань натуры пленника.`
  ];
  for (const trait of traits) {
    const line = TRAIT_BIOGRAPHY_LINES[trait.id];
    if (line) paragraphs.push(line(char, ve));
  }
  return paragraphs;
}

function personalityParagraph(rng: () => number, char: Character, ve: string): string {
  const submission = char.submission ?? 50;
  const loyalty = char.loyalty ?? 0;
  if (submission >= 70 && loyalty >= 50) {
    return `${char.name} принял${ve} новые условия и не проявляет сопротивления — покорность высокая, лояльность растёт.`;
  }
  if (submission >= 70) {
    return `Покорность ${char.name} высокая, но лояльность пока низкая: внешне послушн${ve === 'и' ? 'ые' : ve === 'а' ? 'ая' : 'ый'}, внутри ещё не сломлен${ve}.`;
  }
  if (submission >= 40) {
    return pickFrom(rng, [
      `${char.name} держит нейтралитет: часть надежд ещё жива, часть уже смирил${ve}ся с участью.`,
      `Смешанные чувства: ${char.name} не бунтует открыто, но и не скрывает недовольства.`
    ]);
  }
  return `${char.name} бунтует внутри — каждый новый день воспринимает как испытание, лояльность на нуле.`;
}

export interface PrisonerFamilyMember {
  kind: 'mother' | 'child' | 'relative';
  name: string;
  /** Степень родства: «мать», «сын», «дочь», «брат» и т. п. */
  relation: string;
  /** Деталь, например возраст: «54 года», «5 лет», «2 года 3 мес.». */
  detail: string;
  /** Пол ребёнка — для согласования глаголов. */
  female?: boolean;
  /** Ребёнок рождён в плену и находится в лагере, а не в родном регионе. */
  inCamp?: boolean;
}

const RELATIVE_RELATIONS = ['брат', 'сестра', 'дядя', 'тётя', 'двоюродный брат', 'двоюродная сестра'];

/** Возраст иждивенца в годах и месяцах для биографии и чата. */
function dependentAgeText(ageDays: number): string {
  const years = Math.floor(ageDays / 365);
  const months = Math.floor((ageDays % 365) / 30);
  if (years === 0) return months === 1 ? '1 месяц' : `${months} мес.`;
  const yearText = years === 1 ? '1 год' : years < 5 ? `${years} года` : `${years} лет`;
  return months > 0 ? `${yearText} ${months} мес.` : yearText;
}

/**
 * Детерминированный родственник пленника: мать, ребёнок или другой
 * родственник. Реальные дети, рождённые в плену, берутся из реестра
 * иждивенцев — они важнее случайного броска. Отдельный сид генератора
 * не меняет остальные абзацы биографии.
 */
export function prisonerFamily(char: Character, dependents?: Dependent[]): PrisonerFamilyMember | null {
  const rng = mulberry32(hashSeed(`${char.id}:family`));
  const children = (dependents ?? []).filter(dependent => dependent.guardianCharacterId === char.id);
  if (children.length > 0) {
    const child = children[0];
    return {
      kind: 'child',
      name: child.name,
      relation: child.gender === 'female' ? 'дочь' : 'сын',
      detail: dependentAgeText(child.ageDays),
      female: child.gender === 'female',
      inCamp: true
    };
  }
  const roll = rng();
  if (roll < 0.4) {
    return {
      kind: 'mother',
      name: `${pickFrom(rng, FIRST_NAMES.women)} ${pickFrom(rng, LAST_NAMES)}`,
      relation: 'мать',
      detail: `${42 + Math.floor(rng() * 23)} года`
    };
  }
  if (roll < 0.7) {
    const female = rng() < 0.5;
    const age = 2 + Math.floor(rng() * 12);
    return {
      kind: 'child',
      name: `${pickFrom(rng, female ? FIRST_NAMES.women : FIRST_NAMES.men)} ${pickFrom(rng, LAST_NAMES)}`,
      relation: female ? 'дочь' : 'сын',
      detail: age === 1 ? '1 год' : age < 5 ? `${age} года` : `${age} лет`,
      female
    };
  }
  const relation = pickFrom(rng, RELATIVE_RELATIONS);
  const female = relation === 'сестра' || relation === 'тётя' || relation === 'двоюродная сестра';
  return {
    kind: 'relative',
    name: `${pickFrom(rng, female ? FIRST_NAMES.women : FIRST_NAMES.men)} ${pickFrom(rng, LAST_NAMES)}`,
    relation,
    detail: ''
  };
}

/** Абзац биографии о матери, ребёнке или родственнике пленника. */
function familyParagraph(char: Character, family: PrisonerFamilyMember): string {
  const region = char.regionName;
  const object = pronounsFor(char.gender).object;
  if (family.kind === 'mother') {
    return `Мать ${char.name} — ${family.name}, ${family.detail}, — осталась в регионе ${region} и не знает о судьбе ${object}.`;
  }
  if (family.kind === 'child') {
    if (family.inCamp) {
      return `У ${char.name} есть ${family.relation} — ${family.name}, ${family.detail}, — растёт в лагере и числится отдельно, пока не станет собственностью компании.`;
    }
    const stayed = family.female ? 'осталась' : 'остался';
    return `У ${char.name} есть ${family.relation} — ${family.name}, ${family.detail}, — ${stayed} в регионе ${region} и ждёт ${object}.`;
  }
  return `Родственник ${char.name} — ${family.name}, ${family.relation}, — живёт в регионе ${region} и помнит ${char.name} по прежней жизни.`;
}

/**
 * Детерминированная «история попадания на рынок»: биография пленника,
 * собранная из его реестровых данных. Один и тот же пленник всегда
 * получает одну и ту же историю — генератор заточен под id персонажа.
 * `dependents` — реестр иждивенцев: дети, рождённые в плену, упоминаются
 * в биографии вместо случайного родственника.
 */
export function buildMarketEntryStory(char: Character, dependents?: Dependent[]): string[] {
  const rng = mulberry32(hashSeed(char.id));
  const ve = verbEndFor(char.gender);
  const country = char.country || 'неизвестной страны';
  const paragraphs: string[] = [];

  paragraphs.push(
    `Родина ${char.name} — ${country} (${char.regionName}). До пленения ${char.name} был${ve} ${formerOccupation(rng, char)}; возраст на момент захвата — ${char.age} лет.`
  );
  const family = prisonerFamily(char, dependents);
  if (family) {
    paragraphs.push(familyParagraph(char, family));
  }
  paragraphs.push(captureParagraph(rng, char, ve));
  paragraphs.push(
    pickFrom(rng, [
      `Дорога на рынок заняла недели: перевалочные пункты, конвои и печати брокеров — всё это ${pronounsFor(char.gender).subject} запомнил${ve} надолго.`,
      `Через цепочку посредников ${char.name} провели по невольничьим рынкам региона, пока цена не стала выгодной для покупателя.`
    ])
  );

  const week = char.acquiredWeek ?? '—';
  paragraphs.push(
    `В неделю ${week} ${char.name} попал${ve} в реестр синдиката: рыночная оценка — ${formatMoney((char.price ?? 0))}, навык ${char.skill}, покорность ${char.submission ?? 50}%, лояльность ${char.loyalty ?? 0}.`
  );
  paragraphs.push(personalityParagraph(rng, char, ve));
  paragraphs.push(traitsParagraph(char));

  return paragraphs;
}

/** Приветствия чата от лица пленника — по первой черте характера. */
const TRAIT_GREETINGS: Record<string, (char: Character) => string> = {
  pt_stoic: char => `${char.name} стоит у стены, не поднимая глаз. Молчит, пока не заговорят первым.`,
  pt_defiant: char => `${char.name} смотрит вызывающе: «И что, синдикат прислал нового допрашивать?»`,
  pt_meek: char => `${char.name} кивает, стараясь занять как можно меньше места. «Да, хозяин», — тихо отвечает ${pronounsFor(char.gender).subject}.`,
  pt_cunning: char => `${char.name} окидывает взглядом уголёк и улыбается: «Поговорим. Только я выбираю тему».`,
  pt_dreamer: char => `${char.name} смотрит в даль: «Знаешь, дома в это время года цветёт миндаль…»`,
  pt_phlegmatic: char => `${char.name} ровно кивает: «Говори — я слушаю. Спешки не понимаю».`,
  pt_hot_tempered: char => `${char.name} вспыхивает с порога: «Ну? Спрашивай, раз уж пришёл!» — и тут же остывает.`,
  pt_sociable: char => `${char.name} оживляется: «О, гость! Давно никто не заходил — расскажи, как дела?»`,
  pt_loner: char => `${char.name} отходит в тень, но не уходит: «Говори. Слушаю, но не обещаю отвечать».`,
  pt_resilient: char => `${char.name} вытирает руки о штаны: «Спрашивай. Я крепкий — меня не сломать».`,
  pt_anxious: char => `${char.name} косится на дверь: «Тише… вдруг надсмотрщик услышит. Что нужно?»`,
  pt_proud: char => `${char.name} выпрямляется: «Имя моё — не для торга. Спрашивай, если достоин ответа».`,
  pt_pragmatist: char => `${char.name} пожимает плечами: «Плен — дело привычки. Задавай вопрос, получишь ответ».`,
  pt_sentimental: char => `${char.name} гладит старую тряпку: «Поговори со мной… я так скучаю по дому».`,
  pt_shrewd: char => `${char.name} щурится: «Ты что-то хочешь. Люди не приходят просто так — говори».`,
  pt_stubborn: char => `${char.name} скрещивает руки: «Говори. Но решения я не меняю — ни за что».`,
  pt_optimist: char => `${char.name} улыбается: «Привет! Даже здесь бывает хороший день, правда?»`,
  pt_pessimist: char => `${char.name} вздыхает: «Что ещё осталось спросить? Всё равно хуже не будет».`,
  pt_faithful: char => `${char.name} оглядывается, потом тихо: «Ты от хозяина? Если от него — я слушаю».`,
  pt_vindictive: char => `${char.name} усмехается: «Говори. Я всё запоминаю — на всякий случай».`,
};

/** Приветствие чата от лица пленника — зависит от черт характера. */
export function traitChatGreeting(char: Character): string {
  const first = prisonerTraits(char)[0];
  const greeting = first ? TRAIT_GREETINGS[first.id] : undefined;
  return greeting ? greeting(char) : `${char.name} поднимает глаза: «Говори».`;
}

/** Реплики-заглушки чата — по первой черте характера. */
const TRAIT_FALLBACKS: Record<string, (char: Character, ve: string) => string[]> = {
  pt_stoic: (char, _ve) => [
    `${char.name} молчит. Молчание — единственный ответ.`,
    `${char.name} смотрит сквозь собеседника, будто тот — стена.`
  ],
  pt_defiant: (char, _ve) => [
    `«Не командуй мне. Я слышу, но не слушаю», — бросает ${char.name}.`,
    `${char.name} скривится: «Синдикат и его вопросы — в одну корзину».`
  ],
  pt_meek: (char, _ve) => [
    `«Да… как скажешь», — тихо отвечает ${char.name}.`,
    `${char.name} кивает, не глядя в глаза: «Простите, я не знаю, что сказать».`
  ],
  pt_cunning: (char, _ve) => [
    `«Хм… А что мне с этого?», — хитро улыбается ${char.name}.`,
    `${char.name} оценивающе смотрит: «Вопрос неплохой. Но ответ стоит денег».`
  ],
  pt_dreamer: (char, _ve) => [
    `«Знаешь, дома сейчас…» — ${char.name} замолкает, уносясь в воспоминания.`,
    `${char.name} смотрит в потолок: «Я всё ещё жду. Свобода — вопрос времени».`
  ],
  pt_phlegmatic: (char, _ve) => [
    `${char.name} спокойно кивает: «Понял. Дальше — как обычно».`,
    `«Не вижу причин волноваться», — ровно говорит ${char.name}.`
  ],
  pt_hot_tempered: (char, _ve) => [
    `«Ну скажи уже нормально!» — вспыхивает ${char.name}, тут же успокаиваясь.`,
    `${char.name} закатывает глаза: «Опять вопросы… Ладно, говори дальше».`
  ],
  pt_sociable: (char, _ve) => [
    `«О, интересно!» — оживляется ${char.name}. «А у тебя как?»`,
    `${char.name} смеётся: «Хороший вопрос! Продолжай, я слушаю».`
  ],
  pt_loner: (char, _ve) => [
    `${char.name} отворачивается: «Я не из тех, кто разговаривает».`,
    `«Мне некому рассказывать. И не проси», — тихо говорит ${char.name}.`
  ],
  pt_resilient: (char, _ve) => [
    `«Меня не сломать. Спрашивай дальше», — отвечает ${char.name}.`,
    `${char.name} пожимает плечами: «Что ни день — то испытание. Я держусь».`
  ],
  pt_anxious: (char, _ve) => [
    `${char.name} косится на дверь: «Тише… вдруг услышат».`,
    `«А это точно безопасно спрашивать?» — нервно уточняет ${char.name}.`
  ],
  pt_proud: (char, _ve) => [
    `«Я не раб разговоров. Но раз спросил — отвечу», — холодно говорит ${char.name}.`,
    `${char.name} выпрямляется: «Достоинство не продаётся. Даже за свободу».`
  ],
  pt_pragmatist: (char, _ve) => [
    `«Ладно, принимаю как есть. Дальше?» — пожимает плечами ${char.name}.`,
    `${char.name} практично: «Что имеем — то и имеем. Спрашивай».`
  ],
  pt_sentimental: (char, _ve) => [
    `${char.name} отворачивается, чтобы скрыть слёзы: «Простите… я вспомнил дом».`,
    `«Ты не представляешь, как я скучаю», — шепчет ${char.name}.`
  ],
  pt_shrewd: (char, _ve) => [
    `${char.name} щурится: «Ты что-то вычисляешь? Я вижу, как люди играют».`,
    `«Интересно, зачем ты это спрашиваешь», — замечает ${char.name}.`
  ],
  pt_stubborn: (char, _ve) => [
    `«Моё мнение не изменится. Ни сейчас, ни потом», — твёрдо говорит ${char.name}.`,
    `${char.name} скрещивает руки: «Спорить бесполезно. Я так решил».`
  ],
  pt_optimist: (char, _ve) => [
    `«Знаешь, всё наладится!» — улыбается ${char.name}.`,
    `${char.name} подмигивает: «Даже здесь бывает хороший день».`
  ],
  pt_pessimist: (char, _ve) => [
    `«Зачем ты это спрашиваешь? Всё равно плохо», — вздыхает ${char.name}.`,
    `${char.name} смотрит в пол: «Я уже перестал надеяться. Не трать время».`
  ],
  pt_faithful: (char, _ve) => [
    `«Ты от того, кому я верен? Тогда говори», — внимательно говорит ${char.name}.`,
    `${char.name} кивает: «Я верю людям, которые доказали силу. Ты пока проверяешься».`
  ],
  pt_vindictive: (char, _ve) => [
    `${char.name} усмехается: «Я всё запоминаю. Всё».`,
    `«Обиды не прощают. Вопросы — тоже», — холодно говорит ${char.name}.`
  ]
};

/** Подсказки для чата — под первую черту характера пленника. */
const TRAIT_SUGGESTIONS: Record<string, string[]> = {
  pt_stoic: ['Ты вообще чувствуешь?', 'Что тебя держит здесь?', 'Расскажи о родине'],
  pt_defiant: ['Ты бунтуешь?', 'Что синдикат у тебя забрал?', 'Ты когда-нибудь сбежишь?'],
  pt_meek: ['Тебе страшно?', 'Что тебе приказали?', 'Ты смирился?'],
  pt_cunning: ['Как ты выкручиваешься?', 'Где здесь выгодный угол?', 'Ты всех обманываешь?'],
  pt_dreamer: ['О чём ты мечтаешь?', 'Какая у тебя родина?', 'Ты ждёшь свободу?'],
  pt_phlegmatic: ['Ты никогда не злишься?', 'Что тебя пугает?', 'Как ты держишься?'],
  pt_hot_tempered: ['Ты быстро злишься?', 'Что тебя взбесило?', 'Ты быстро остываешь?'],
  pt_sociable: ['С кем ты дружишь?', 'Ты скучаешь по людям?', 'Расскажи о себе'],
  pt_loner: ['Ты никому не доверяешь?', 'Почему ты один?', 'Кому ты доверяешь?'],
  pt_resilient: ['Что тебя не сломало?', 'Ты не устал?', 'Как ты выдерживаешь?'],
  pt_anxious: ['Чего ты боишься?', 'Ты в опасности?', 'Что будет завтра?'],
  pt_proud: ['Откуда твоя гордость?', 'Ты всё ещё благороден?', 'Что для тебя честь?'],
  pt_pragmatist: ['Ты принял плен?', 'Как ты приспособился?', 'Что ты здесь понял?'],
  pt_sentimental: ['По кому ты скучаешь?', 'Что ты вспоминаешь?', 'Ты плачешь по ночам?'],
  pt_shrewd: ['Что ты обо мне думаешь?', 'Ты меня читаешь?', 'Кто здесь главный?'],
  pt_stubborn: ['Ты никогда не сдаёшься?', 'Что заставит сменить решение?', 'Ты упрямый?'],
  pt_optimist: ['Во что ты веришь?', 'Ты видишь свет?', 'Что хорошего здесь есть?'],
  pt_pessimist: ['Ты ждёшь худшего?', 'Что тебя мучает?', 'Ты ещё надеешься?'],
  pt_faithful: ['Кому ты верен?', 'Тебя можно купить?', 'Кто заслужил твою веру?'],
  pt_vindictive: ['Кто тебя обидел?', 'Ты ждёшь мести?', 'Что ты не прощаешь?']
};

/** Подсказки чата для пленника — по его чертам характера. */
export function traitChatSuggestions(char: Character): string[] {
  const first = prisonerTraits(char)[0];
  return first ? TRAIT_SUGGESTIONS[first.id] ?? [] : [];
}

/** Ответ локального «ИИ»-собеседника: ключевые слова пользователя → реплика от лица пленника. */
export function respondToPrisonerMessage(char: Character, message: string, dependents?: Dependent[]): string {
  const text = message.toLocaleLowerCase('ru');
  const ve = verbEndFor(char.gender);
  const country = char.country || 'неизвестная страна';
  const has = (...words: string[]) => words.some(word => text.includes(word));

  if (has('привет', 'здравствуй', 'здравствуйте', 'хай', 'добрый')) {
    return pickFrom(Math.random, [
      `${char.name} кивает, не поднимая глаз.`,
      `«Приветствую, хозяин», — тихо отвечает ${char.name}.`
    ]);
  }
  if (has('имя', 'зовут')) {
    return `«Меня зовут ${char.name}. Родом из ${country}», — говорит ${char.name}.`;
  }
  if (has('откуда', 'родина', 'страна', 'где жил', 'где родил')) {
    return `«Моя родина — ${country}, регион ${char.regionName}», — отвечает ${char.name}.`;
  }
  if (has('мать', 'родитель', 'семья', 'ребенок', 'ребёнок', 'родственник', 'дочь', 'сын')) {
    const family = prisonerFamily(char, dependents);
    if (family?.kind === 'mother') {
      return `«Моя мать — ${family.name}, ${family.detail}, в регионе ${char.regionName}. Синдикат забрал меня, а её оставил», — говорит ${char.name}.`;
    }
    if (family?.kind === 'child' && family.inCamp) {
      return `«У меня есть ${family.relation} — ${family.name}, ${family.detail}. Ребёнок здесь, в лагере, и числится отдельно», — тихо говорит ${char.name}.`;
    }
    if (family?.kind === 'child') {
      return `«У меня есть ${family.relation} — ${family.name}, ${family.detail}. ${family.female ? 'Она' : 'Он'} остал${family.female ? 'ась' : 'ся'} в регионе ${char.regionName}», — говорит ${char.name}.`;
    }
    if (family) {
      return `«Мой ${family.relation} — ${family.name} — живёт в регионе ${char.regionName} и помнит меня по прежней жизни», — отвечает ${char.name}.`;
    }
  }
  if (has('рынок', 'попадания', 'попал', 'попала', 'попали', 'как ты сюда', 'как оказал')) {
    return `«Меня продали на рынке — ${slaveOriginLabel(char.slaveOrigin).toLowerCase()}. Дальше конвои и реестр синдиката», — рассказывает ${char.name}.`;
  }
  if (has('захват', 'плен', 'засад', 'нападен', 'украл', 'похит')) {
    return `«${captureParagraph(Math.random, char, ve)}», — вспоминает ${char.name} с трудом.`;
  }
  if (has('настроение', 'чувств', 'как дела', 'самочувств')) {
    const submission = char.submission ?? 50;
    if (submission >= 70) {
      return `«Настроение ровное. Сопротивляться бессмысленно — я принял${ve} свой удел», — отвечает ${char.name}.`;
    }
    if (submission >= 40) {
      return `«Чувствую себя странно: часть надежд ещё жива, часть уже мертва», — признаётся ${char.name}.`;
    }
    return `«Внутри бунт. Каждый день — как последняя капля», — говорит ${char.name} сквозь зубы.`;
  }
  if (has('характер', 'темперамент', 'личность', 'какой ты', 'какая ты')) {
    const traits = prisonerTraits(char);
    const names = traits.map(trait => trait.name.toLowerCase()).join(' и ');
    const details = traits.map(trait => trait.description).join('; ');
    return `«Я — ${names}: ${details}», — говорит ${char.name}.`;
  }
  if (has('возраст', 'сколько лет')) {
    return `«Мне ${char.age} лет», — отвечает ${char.name}.`;
  }
  if (has('навык', 'умеешь', 'умею', 'делаешь', 'работа', 'професс')) {
    return `«Мой навык — ${char.skill} из 100. До пленения я был${ve} ${formerOccupation(Math.random, char)}», — говорит ${char.name}.`;
  }
  if (has('хозяин', 'синдикат', 'начальник', 'господин', 'владел')) {
    const loyalty = char.loyalty ?? 0;
    if (loyalty >= 50) {
      return `«Синдикат — мой мир теперь. Я служу ему», — отвечает ${char.name}.`;
    }
    return `«Синдикат забрал всё. Что ещё спросишь?», — холодно говорит ${char.name}.`;
  }
  if (has('свобода', 'свобод', 'побег', 'убеж', 'бег')) {
    const submission = char.submission ?? 50;
    if (submission >= 60) {
      return `«Свобода — мишура. Я давно смирил${ve}ся», — вздыхает ${char.name}.`;
    }
    return `«Свобода — всё, что у меня осталось», — шепчет ${char.name}.`;
  }
  if (has('спасибо', 'благодар')) {
    return `«Не благодари», — отводит взгляд ${char.name}.`;
  }
  if (has('да', 'нет', 'хорошо', 'понял', 'ок', 'конечно')) {
    return `«Понял${ve}», — кивает ${char.name}.`;
  }
  const firstTraitId = prisonerTraits(char)[0]?.id;
  const traitFallbacks = firstTraitId ? TRAIT_FALLBACKS[firstTraitId]?.(char, ve) ?? [] : [];
  return pickFrom(Math.random, [
    ...traitFallbacks,
    `${char.name} молчит, глядя в пол. Очевидно, тема не из приятных.`,
    `«Не знаю, что ещё сказать. Спроси о чём-нибудь другом», — отвечает ${char.name}.`,
    `${char.name} перебирает пальцами, подбирая слова: «Моя история — это рынок, конвой и реестр. Больше рассказывать нечего».`,
    `«Я слушаю, хозяин», — говорит ${char.name}, но в глазах — пустота.`
  ]);
}
