import type { AuxiliaryBuildingState, Employee, EmployeeCandidate } from './expansionTypes';
import type { ExpansionEvent } from './expansionTypes';
import { assetUrl } from './assetUrl';
import {
  DEFAULT_PORTRAIT_FOLDER,
  pickCeoModelPath,
  pickCeoPortraitName,
  pickPortraitFileNumber,
  pickPortraitModelPath,
  type PortraitSex
} from './portraitAssets';

export type PregnancyStatus = 'pregnant' | 'hospitalized';

export interface PregnancyState {
  status: PregnancyStatus;
  daysPregnant: number;
  hospitalWeeksRemaining?: number;
  /** Ward the mother is booked into, set by the hospital on admission. */
  wardId?: string;
  /**
   * Why the bed is held: a delivery at term, or an observation stay the medical
   * staff booked early because the pregnancy looked like a risky case.
   */
  hospitalAdmission?: 'birth' | 'observation';
}

export type DependentGender = 'female' | 'male';

export interface Dependent {
  id: string;
  name: string;
  gender: DependentGender;
  guardianCharacterId: string;
  guardianName: string;
  regionId: string;
  ageDays: number;
  bornWeek: number;
}

export interface Character {
  id: string;
  name: string;
  gender: 'women' | 'men' | 'trans';
  region: string;
  regionName: string;
  country?: string; // birthplace, drawn from the region of origin
  city?: string; // major city of origin, drawn from the region
  age: number; // 18-60
  role: string;
  price: number;
  skill: number; // 1-100
  loyalty: number; // 1-100
  image: string;
  /**
   * glTF model URL for the 3D portrait, mirroring `image`
   * (`/portraits3d/...`). Undefined while the character's
   * region/sex folder has no converted models — renderers
   * must fall back to the 2D `image` in that case.
   */
  model3d?: string;
  /** Assignment marker while away from the syndicate, e.g. `capture_op:<id>`. */
  assignedTask?: string;
  /** `unassigned` keeps the operative on payroll without a venue: no income, no shift fatigue. */
  assignedVenue?: 'beauty_salon' | 'strip_club' | 'pleasure_house' | 'trade' | 'security' | 'auction_house' | 'bdsm_room' | 'unassigned';
  /** Managerial role within the syndicate: 'none', 'overseer', or 'administrator' (venue-specific manager) */
  managerialRole: 'none' | 'overseer' | 'administrator';
  /** ID of the overseer/admin managing this character, if any. */
  managedBy?: string | null;
  // Set when the operative has been hired off the Global Marketplace, so the
  // next market refresh knows which slots need a new face.
  acquired?: boolean;
  /**
   * Campaign week the operative joined the company — the week they were bought,
   * captured, graduated or started with the campaign. Drives the roster sort by
   * purchase week and the «Неделя покупки» badge.
   */
  acquiredWeek?: number;
  /** Specialist role: 'Janitor', 'Dominatrix', 'Master', etc. */
  specialty?: string;
  // Appearance & Health properties
  healthLevel: 'Pristine' | 'Good' | 'Fair' | 'Poor' | 'Critical';
  exhaustionLevel: 'Rested' | 'Tired' | 'Exhausted' | 'Burned Out';
  exactHealth: number; // 0-100 (shown only for CEO)
  exactExhaustion: number; // 0-100 (shown only for CEO)
  headHairStyle: string;
  headHairLength: number; // cm
  facialHairStyle: string;
  pubicHairStyle: string;
  pubicHairLength: string; // e.g. 'Trimmed', 'Long', 'Smooth'
  tanningLevel: number; // 0-100, fades weekly unless maintained
  skinCondition: 'Flawless' | 'Clear' | 'Dry' | 'Blemished' | 'Irritated';
  // Submission & Pleasure House stats
  submission: number; // 0-100 (obedience & compliance)
  pleasureStats: {
    vaginalCount: number;
    analCount: number;
    totalEarnings: number;
  };
  /** Pregnancy belongs only to adult women slaves; dependents use a separate type. */
  pregnancy?: PregnancyState;
  /**
   * Physical wounds carried by the character. Three wounds are fatal; a single
   * wound past 100 severity kills as well. Cleared by hospital treatment.
   */
  wounds?: import('./woundEngine').Wound[];
  /** Set when a belly wound leaves a woman unable to conceive. */
  infertile?: boolean;
  /** 0-100; fear drives the Correction Centre's obedience courses. */
  fear?: number;
  /** 0-100; long-term submission accrued when fear exceeds its conversion threshold. */
  assimilation?: number;
  /** 0-100; reduced by wounds and exhaustion, driving market value. */
  libido?: number;
  /** Marker granted by the School's Basic/Vocational courses. */
  trainedAtEmporium?: boolean;
  /** Teaching aptitude of a staff member running School or Correction Centre courses. */
  teachingSkill?: number;
  /** 0-100; engaging delivery of lessons and commercial pitches. */
  charisma?: number;
  /** 0-100; structured, analytical work (School, Self-Development Centre). */
  intelligence?: number;
  /** 0-100; fine manual work — lowered by arm wounds. */
  dexterity?: number;
  /** 0-100; stamina — lowered by leg and torso wounds. */
  endurance?: number;
  /** Psychological traits managed by the Self-Development Centre. */
  traits?: import('./selfDevelopmentEngine').TraitId[];
  // Captured enemies / slaves (e.g. from caravan raids). Optional so existing
  // hires remain unaffected.
  isSlave?: boolean;
  slaveOrigin?: string; // where they were captured, e.g. 'caravan_raid'
  biography?: string; // AI-generated backstory of how they entered sex slavery
}

export interface Caravan {
  id: string;
  name: string;
  originRegion: string;
  destRegion: string;
  leaderName: string;
  /** Roster id of the caravan leader; name is kept only for display. */
  leaderId?: string;
  investment: number;
  potentialProfit: number;
  weeksTotal: number;
  weeksRemaining: number;
  status: 'traveling' | 'completed' | 'raided' | 'lost';
  /** How many ambushes already fired on this caravan (it is ambushed weekly). */
  raidsTriggered?: number;
  /** Campaign week the caravan was dispatched. */
  dispatchedWeek?: number;
  /** Campaign week the caravan reached a terminal state (completed / raided / lost). */
  endWeek?: number;
}

export interface LoanApplication {
  amount: number;
  termWeeks: number;
  repaymentType: 'fixed' | 'income_share'; // fixed instalments or income share
  interestRate: number;
  remainingPrincipal: number;
  weeksPaid: number;
  weeklyPayment: number;
}

/** Full financial breakdown of the last completed week, shown in the Finance & Loans tab. */
export interface WeeklyFinanceReport {
  week: number;
  revenue: {
    venue: number;
    caravans: number;
    captureOps: number;
    contracts: number;
    salon: number;
  };
  expenses: {
    wages: number;
    hospital: number;
    restZone: number;
    staffSlots: number;
    loanPayment: number;
  };
  netIncome: number;
  treasuryAfter: number;
}

import type { BankruptcyCase } from './bankruptcyEngine';

export interface CampaignState {
  version: number;
  slot: number;
  campaignName: string;
  week: number;
  funds: number;
  reputation: number;
  isBankrupt: boolean;
  isReceivership: boolean;
  /** Filed bankruptcy procedure (court or bank/board path), null when none. */
  bankruptcyCase: BankruptcyCase | null;
  activeLoan: LoanApplication | null;
  /** Full report for the last completed week; null until the first week is advanced. */
  lastWeeklyReport: WeeklyFinanceReport | null;
  roster: Character[];
  marketPool: Character[];
  /** Tracks purchase pressure per region to drive dynamic pricing. */
  marketDemand: Record<string, number>;
  /** Regional influence/standing (0-100). Affects purchase costs and candidate quality. */
  regionalStanding: Record<string, number>;
  caravans: Caravan[];
  employees: Employee[];
  employeeCandidates: EmployeeCandidate[];
  /**
   * Staff positions the company can fill. Starts at the free base headcount and
   * grows by purchase, so the hiring limit is the player's money rather than a
   * hard cap.
   */
  hiringSlots: number;
  auxiliaryBuildings: AuxiliaryBuildingState[];
  seenExpansionEventIds: string[];
  pendingExpansionEvents?: ExpansionEvent[];
  log: string[];
  /** Tracks if the weekly market asset refresh has occurred for the current week. */
  marketRefreshDone: boolean;
  /** List of purchased permanent upgrades. */
  purchasedUpgrades: string[];
  /** School enrolments: who is attending which course. */
  schoolEnrolments?: import('./schoolEngine').SchoolEnrolment[];
  /** Correction Centre enrolments: who is undergoing which course. */
  correctionEnrolments?: import('./correctionEngine').CorrectionEnrolment[];
  /** Assigned teacher running the School's courses. */
  schoolTeacherId?: string | null;
  /** Assigned medic running the Correction Centre's on-site care. */
  correctionMedicId?: string | null;
}

export const REGIONS = [
  { id: '01_north_america', name: 'Северная Америка и Карибы', code: '01' },
  { id: '02_south_america', name: 'Южная Америка', code: '02' },
  { id: '03_western_europe', name: 'Западная Европа и Скандинавия', code: '03' },
  { id: '04_eastern_europe', name: 'Восточная Европа и Балканы', code: '04' },
  { id: '05_middle_east', name: 'Ближний Восток и Кавказ', code: '05' },
  { id: '06_north_africa', name: 'Северная Африка и Сахель', code: '06' },
  { id: '07_west_africa', name: 'Западная Африка', code: '07' },
  { id: '08_central_africa', name: 'Центральная Африка', code: '08' },
  { id: '09_east_south_africa', name: 'Восточная и Южная Африка', code: '09' },
  { id: '10_central_asia', name: 'Центральная Азия и Сибирь', code: '10' },
  { id: '11_east_asia', name: 'Восточная Азия', code: '11' },
  { id: '12_south_asia', name: 'Южная Азия', code: '12' },
  { id: '13_southeast_asia', name: 'Юго-Восточная Азия', code: '13' },
  { id: '14_australia_oceania', name: 'Австралия и Океания', code: '14' },
  { id: '15_roma', name: 'Диаспора рома', code: '15' },
  { id: '16_jewish_diaspora', name: 'Еврейская диаспора', code: '16' },
  { id: '17_pacific_islands', name: 'Тихоокеанские острова', code: '17' },
  { id: '99_ceo', name: 'Исполнительный совет (CEO)', code: '99' }
];

export const REGION_COUNTRIES: Record<string, string[]> = {
  '01_north_america': [
    'Антигуа и Барбуда', 'Багамы', 'Барбадос', 'Белиз', 'Канада', 'Коста-Рика', 'Куба',
    'Доминика', 'Доминиканская Республика', 'Сальвадор', 'Гренада', 'Гватемала', 'Гаити',
    'Гондурас', 'Ямайка', 'Мексика', 'Никарагуа', 'Панама', 'Сент-Китс и Невис',
    'Сент-Люсия', 'Сент-Винсент и Гренадины', 'Тринидад и Тобаго', 'США'
  ],
  '02_south_america': [
    'Аргентина', 'Боливия', 'Бразилия', 'Чили', 'Колумбия', 'Эквадор', 'Гайана', 'Парагвай',
    'Перу', 'Суринам', 'Уругвай', 'Венесуэла'
  ],
  '03_western_europe': [
    'Андорра', 'Австрия', 'Бельгия', 'Дания', 'Финляндия', 'Франция', 'Германия', 'Исландия',
    'Ирландия', 'Италия', 'Лихтенштейн', 'Люксембург', 'Мальта', 'Монако', 'Нидерланды',
    'Норвегия', 'Португалия', 'Сан-Марино', 'Испания', 'Швеция', 'Швейцария', 'Великобритания',
    'Ватикан'
  ],
  '04_eastern_europe': [
    'Албания', 'Беларусь', 'Босния и Герцеговина', 'Болгария', 'Хорватия', 'Чехия',
    'Эстония', 'Греция', 'Венгрия', 'Косово', 'Латвия', 'Литва', 'Молдова', 'Черногория',
    'Северная Македония', 'Польша', 'Румыния', 'Россия', 'Сербия', 'Словакия', 'Словения',
    'Украина'
  ],
  '05_middle_east': [
    'Армения', 'Азербайджан', 'Бахрейн', 'Кипр', 'Грузия', 'Иран', 'Ирак', 'Израиль',
    'Иордания', 'Кувейт', 'Ливан', 'Оман', 'Палестина', 'Катар', 'Саудовская Аравия', 'Сирия',
    'Турция', 'Объединённые Арабские Эмираты', 'Йемен'
  ],
  '06_north_africa': [
    'Алжир', 'Буркина-Фасо', 'Чад', 'Египет', 'Ливия', 'Мали', 'Мавритания', 'Марокко',
    'Нигер', 'Судан', 'Тунис'
  ],
  '07_west_africa': [
    'Бенин', 'Кабо-Верде', 'Кот-д’Ивуар', 'Гамбия', 'Гана', 'Гвинея', 'Гвинея-Бисау',
    'Либерия', 'Нигерия', 'Сенегал', 'Сьерра-Леоне', 'Того'
  ],
  '08_central_africa': [
    'Ангола', 'Камерун', 'Центральноафриканская Республика', 'Демократическая Республика Конго',
    'Экваториальная Гвинея', 'Габон', 'Республика Конго', 'Сан-Томе и Принсипи'
  ],
  '09_east_south_africa': [
    'Ботсвана', 'Бурунди', 'Коморы', 'Джибути', 'Эритрея', 'Эсватини', 'Эфиопия', 'Кения',
    'Лесото', 'Мадагаскар', 'Малави', 'Маврикий', 'Мозамбик', 'Намибия', 'Руанда',
    'Сейшелы', 'Сомали', 'Южная Африка', 'Южный Судан', 'Танзания', 'Уганда', 'Замбия',
    'Зимбабве'
  ],
  '10_central_asia': [
    'Афганистан', 'Казахстан', 'Киргизия', 'Монголия', 'Россия', 'Таджикистан',
    'Туркменистан', 'Узбекистан'
  ],
  '11_east_asia': [
    'Китай', 'Япония', 'Монголия', 'Северная Корея', 'Южная Корея', 'Тайвань'
  ],
  '12_south_asia': [
    'Афганистан', 'Бангладеш', 'Бутан', 'Индия', 'Мальдивы', 'Непал', 'Пакистан',
    'Шри-Ланка'
  ],
  '13_southeast_asia': [
    'Бруней', 'Камбоджа', 'Индонезия', 'Лаос', 'Малайзия', 'Мьянма', 'Филиппины',
    'Сингапур', 'Таиланд', 'Восточный Тимор', 'Вьетнам'
  ],
  '14_australia_oceania': [
    'Австралия', 'Фиджи', 'Кирибати', 'Маршалловы Острова', 'Микронезия', 'Науру',
    'Новая Зеландия', 'Палау', 'Папуа — Новая Гвинея', 'Самоа', 'Соломоновы Острова', 'Тонга',
    'Тувалу', 'Вануату'
  ],
  '15_roma': [
    'Албания', 'Босния и Герцеговина', 'Болгария', 'Хорватия', 'Чехия', 'Франция',
    'Германия', 'Греция', 'Венгрия', 'Италия', 'Косово', 'Молдова', 'Черногория',
    'Нидерланды', 'Северная Македония', 'Польша', 'Румыния', 'Россия', 'Сербия', 'Словакия',
    'Испания', 'Турция', 'Украина', 'Великобритания'
  ],
  '16_jewish_diaspora': [
    'Аргентина', 'Австралия', 'Бельгия', 'Бразилия', 'Канада', 'Франция', 'Германия', 'Венгрия',
    'Израиль', 'Италия', 'Мексика', 'Нидерланды', 'Польша', 'Россия', 'Южная Африка', 'Испания',
    'Украина', 'Великобритания', 'США', 'Уругвай'
  ],
  '17_pacific_islands': [
    'Фиджи', 'Кирибати', 'Маршалловы Острова', 'Микронезия', 'Науру',
    'Палау', 'Папуа — Новая Гвинея', 'Самоа', 'Соломоновы Острова', 'Тонга',
    'Тувалу', 'Вануату', 'Французская Полинезия', 'Новая Каледония', 'Гуам',
    'Северные Марианские Острова', 'Американское Самоа', 'Уоллис и Футуна', 'Токелау', 'Питкэрн'
  ],
  '99_ceo': ['Женева (Швейцария)', 'Лондон (Великобритания)', 'Сингапур']
};

export const REGION_CITIES: Record<string, string[]> = {
  '01_north_america': [
    'Нью-Йорк', 'Лос-Анджелес', 'Чикаго', 'Хьюстон', 'Торонто', 'Мехико',
    'Гавана', 'Майами', 'Ванкувер', 'Монреаль', 'Сан-Франциско', 'Атланта',
    'Даллас', 'Кингстон', 'Порт-оф-Спейн', 'Сан-Хуан', 'Гватемала',
    'Сан-Хосе', 'Панама', 'Нассау'
  ],
  '02_south_america': [
    'Буэнос-Айрес', 'Сан-Паулу', 'Рио-де-Жанейро', 'Богота', 'Лима',
    'Сантьяго', 'Каракас', 'Кито', 'Ла-Пас', 'Монтевидео', 'Асунсьон',
    'Парамарибо', 'Джорджтаун', 'Бразилиа', 'Сальвадор', 'Форталеза',
    'Медельин', 'Кали', 'Гуаякиль', 'Вальпараисо'
  ],
  '03_western_europe': [
    'Лондон', 'Париж', 'Берлин', 'Мадрид', 'Рим', 'Амстердам', 'Брюссель',
    'Вена', 'Стокгольм', 'Осло', 'Копенгаген', 'Хельсинки', 'Дублин',
    'Лиссабон', 'Цюрих', 'Женева', 'Мюнхен', 'Гамбург', 'Милан', 'Барселона',
    'Рейкьявик', 'Монако', 'Вадуц', 'Люксембург', 'Сан-Марино',
    'Андорра-ла-Велья', 'Ватикан'
  ],
  '04_eastern_europe': [
    'Москва', 'Санкт-Петербург', 'Киев', 'Варшава', 'Прага', 'Будапешт',
    'Бухарест', 'София', 'Афины', 'Белград', 'Загреб', 'Сараево', 'Подгорица',
    'Скопье', 'Тирана', 'Кишинёв', 'Минск', 'Калинковичи', 'Вильнюс', 'Рига', 'Таллин',
    'Братислава', 'Любляна', 'Краков', 'Одесса', 'Харьков'
  ],
  '05_middle_east': [
    'Стамбул', 'Анкара', 'Тегеран', 'Багдад', 'Дамаск', 'Алеппо',
    'Иерусалим', 'Тель-Авив', 'Бейрут', 'Амман', 'Эр-Рияд', 'Джидда',
    'Доха', 'Дубай', 'Абу-Даби', 'Кувейт', 'Манама', 'Маскат', 'Ереван',
    'Баку', 'Тбилиси', 'Никосия', 'Сана', 'Мосул', 'Басра', 'Шираз',
    'Исфахан'
  ],
  '06_north_africa': [
    'Каир', 'Александрия', 'Алжир', 'Оран', 'Тунис', 'Сфакс', 'Рабат',
    'Касабланка', 'Марракеш', 'Триполи', 'Бенгази', 'Хартум', 'Нуакшот',
    'Бамако', 'Ниамей', 'Нджамена', 'Уагадугу'
  ],
  '07_west_africa': [
    'Лагос', 'Абуджа', 'Аккра', 'Дакар', 'Абиджан', 'Ломе', 'Котону',
    'Фритаун', 'Монровия', 'Банжул', 'Бисау', 'Конакри', 'Прая'
  ],
  '08_central_africa': [
    'Киншаса', 'Браззавиль', 'Яунде', 'Луанда', 'Либревиль', 'Банги',
    'Нджамена', 'Малабо', 'Сан-Томе'
  ],
  '09_east_south_africa': [
    'Найроби', 'Аддис-Абеба', 'Кампала', 'Дар-эс-Салам', 'Могадишо',
    'Джибути', 'Асмара', 'Кигали', 'Бужумбура', 'Лусака', 'Хараре',
    'Мапуту', 'Йоханнесбург', 'Кейптаун', 'Дурбан', 'Виндхук', 'Габороне',
    'Масеру', 'Лилонгве', 'Блантайр', 'Антананариву', 'Порт-Луи', 'Морони',
    'Претория', 'Мбабане', 'Джуба'
  ],
  '10_central_asia': [
    'Алматы', 'Астана', 'Ташкент', 'Самарканд', 'Бишкек', 'Душанбе',
    'Ашхабад', 'Кабул', 'Улан-Батор', 'Новосибирск', 'Екатеринбург',
    'Красноярск', 'Омск', 'Иркутск', 'Владивосток', 'Шымкент',
    'Караганда', 'Нукус', 'Бухара', 'Худжанд', 'Ош'
  ],
  '11_east_asia': [
    'Пекин', 'Шанхай', 'Гуанчжоу', 'Шэньчжэнь', 'Токио', 'Осака', 'Сеул',
    'Пхеньян', 'Тайбэй', 'Гонконг', 'Макао', 'Чунцин', 'Тяньцзинь', 'Ухань',
    'Сиань', 'Ханчжоу', 'Нанкин', 'Циндао', 'Далянь', 'Саппоро', 'Нагоя',
    'Фукуока', 'Пусан', 'Инчхон'
  ],
  '12_south_asia': [
    'Дели', 'Мумбаи', 'Калькутта', 'Ченнаи', 'Бангалор', 'Хайдарабад',
    'Ахмедабад', 'Пуна', 'Карачи', 'Лахор', 'Исламабад', 'Дакка',
    'Катманду', 'Коломбо', 'Тхимпху', 'Мале', 'Кабул'
  ],
  '13_southeast_asia': [
    'Бангкок', 'Ханой', 'Хошимин', 'Джакарта', 'Сингапур', 'Куала-Лумпур',
    'Манила', 'Пномпень', 'Вьентьян', 'Янгон', 'Дили', 'Бандар-Сери-Бегаван',
    'Сиемреап', 'Сурабая', 'Медан', 'Макассар', 'Чиангмай', 'Пхукет',
    'Себу', 'Давао', 'Кучинг', 'Пенанг', 'Хайфон'
  ],
  '14_australia_oceania': [
    'Сидней', 'Мельбурн', 'Брисбен', 'Перт', 'Аделаида', 'Канберра',
    'Окленд', 'Веллингтон', 'Крайстчерч', 'Сува', 'Порт-Морсби', 'Хониара',
    'Порт-Вила', 'Нукуалофа', 'Апиа', 'Фунафути', 'Тарава', 'Маджуро',
    'Ярен', 'Корор'
  ],
  '15_roma': [
    'Скопье', 'София', 'Бухарест', 'Будапешт', 'Белград', 'Сараево',
    'Тирана', 'Кишинёв', 'Мадрид', 'Барселона', 'Париж', 'Марсель', 'Рим',
    'Милан', 'Афины', 'Салоники', 'Стамбул', 'Анкара', 'Варшава', 'Краков',
    'Прага', 'Братислава', 'Лондон', 'Бирмингем', 'Манчестер', 'Москва',
    'Киев', 'Харьков', 'Амстердам', 'Роттердам', 'Кёльн', 'Берлин'
  ],
  '16_jewish_diaspora': [
    'Иерусалим', 'Тель-Авив', 'Нью-Йорк', 'Лос-Анджелес', 'Майами',
    'Торонто', 'Монреаль', 'Лондон', 'Манчестер', 'Париж', 'Марсель',
    'Берлин', 'Мюнхен', 'Вена', 'Будапешт', 'Буэнос-Айрес', 'Сан-Паулу',
    'Рио-де-Жанейро', 'Мехико', 'Москва', 'Санкт-Петербург', 'Киев',
    'Одесса', 'Мельбурн', 'Сидней', 'Амстердам', 'Антверпен', 'Рим',
    'Милан', 'Мадрид', 'Барселона', 'Йоханнесбург', 'Кейптаун',
    'Монтевидео'
  ],
  '17_pacific_islands': [
    'Сува', 'Порт-Вила', 'Хониара', 'Нукуалофа', 'Апиа', 'Фунафути',
    'Тарава', 'Маджуро', 'Ярен', 'Корор', 'Порт-Морсби', 'Нумеа', 'Папеэте',
    'Хагатна', 'Сайпан', 'Паго-Паго', 'Матауту'
  ],
  '99_ceo': ['Женева', 'Лондон', 'Сингапур']
};

export function pickAge(): number {
  return Math.floor(Math.random() * 43) + 18;
}

export function pickCountry(regionId: string): string {
  const pool = REGION_COUNTRIES[regionId];
  if (!pool || pool.length === 0) return 'Неизвестно';
  return pool[Math.floor(Math.random() * pool.length)];
}

export function pickCity(regionId: string): string {
  const pool = REGION_CITIES[regionId];
  if (!pool || pool.length === 0) return 'Неизвестно';
  return pool[Math.floor(Math.random() * pool.length)];
}

export const REGION_FOLDERS: Record<string, string> = {
  '01_north_america': '01_north_america_central_caribbean',
  '02_south_america': '02_south_america',
  '03_western_europe': '03_western_europe_nordics',
  '04_eastern_europe': '04_eastern_europe_balkans_european_russia',
  '05_middle_east': '05_middle_east_caucasus',
  '06_north_africa': '06_north_africa_sahara_horn',
  '07_west_africa': '07_west_africa',
  '08_central_africa': '08_central_africa',
  '09_east_south_africa': '09_east_south_africa',
  '10_central_asia': '10_central_asia_siberia',
  '11_east_asia': '11_east_asia',
  '12_south_asia': '12_south_asia',
  '13_southeast_asia': '13_southeast_asia',
  '14_australia_oceania': '14_australia_oceania',
  '15_roma': '15_roma',
  '16_jewish_diaspora': '16_jewish_diaspora',
  '17_pacific_islands': '17_pacific_islands',
  '99_ceo': '99_CEO'
};

export const FIRST_NAMES = {
  men: [
    'Александр', 'Маркус', 'Дмитрий', 'Тарик', 'Матео', 'Кэндзи', 'Кваме', 'Лиам', 'Сантьяго', 'Ибрагим',
    'Виктор', 'Леон', 'Хабиб', 'Стефан', 'Лукас', 'Рашид', 'Николай', 'Оскар', 'Зейд', 'Акира',
    'Хуан', 'Эрик', 'Ян', 'Амир', 'Саид', 'Артем', 'Феликс', 'Кристиан', 'Мартин', 'Ральф'
  ],
  women: [
    'Елена', 'Амина', 'Мэй', 'София', 'Фатима', 'Изабелла', 'Зара', 'Шанталь', 'Юки', 'Ниа',
    'Анна', 'Лейла', 'Хлоя', 'Мария', 'Самира', 'Эльза', 'Линда', 'Аяка', 'Ясмин', 'Клэр',
    'Диана', 'Сара', 'Наоми', 'Белла', 'Инес', 'Клара', 'Оливия', 'Мира', 'Алиса', 'Нора'
  ],
  trans: [
    'Алекс', 'Джордан', 'Тейлор', 'Морган', 'Кейси', 'Сэм', 'Райли', 'Эйвери',
    'Кирин', 'Пейдж', 'Скай', 'Рен', 'Мика', 'Джуд', 'Вали', 'Ноэль', 'Ривз', 'Клэнси'
  ]
};
  
export const LAST_NAMES = [
  'Вэнс', 'Стерлинг', 'Куросава', 'Аль-Хасан', 'Новак', 'Сильва', 'О’Коннор', 'Дюбуа', 'Мендоса', 'Танака',
  'Миллер', 'Рид', 'Чернов', 'Кастильо', 'Сайто', 'Нгуен', 'Кларк', 'Белфорт', 'Гримальди', 'Хироши',
  'Фрост', 'Джулиан', 'Сендваль', 'Орлов', 'Шнайдер', 'Кравц', 'Мартинес', 'Дэвис', 'Ли', 'Гроссман'
];

export function generateCharacter(regionId?: string, genderOverride?: 'women' | 'men' | 'trans'): Character {
  const reg = regionId ? REGIONS.find(r => r.id === regionId) || REGIONS[0] : REGIONS[Math.floor(Math.random() * REGIONS.length)];
  const genderRand = Math.random();
  const gender: 'women' | 'men' | 'trans' = genderOverride ?? (genderRand < 0.48 ? 'women' : genderRand < 0.96 ? 'men' : 'trans');
  const nameList = FIRST_NAMES[gender];
  const name = `${nameList[Math.floor(Math.random() * nameList.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`;
  
  const skill = Math.floor(Math.random() * 60) + 30;
  const price = Math.floor(skill * 250 + Math.random() * 5000);

  const roles = ['Master Operative', 'Senior Agent', 'Logistics Expert', 'Negotiator', 'Security Chief', 'Accountant'];
  const role = roles[Math.floor(Math.random() * roles.length)];

  const subFolder: PortraitSex = gender === 'women' ? 'women' : gender === 'men' ? 'men' : 'trans';
  const folderName = REGION_FOLDERS[reg.id] || DEFAULT_PORTRAIT_FOLDER;
  let image: string;
  let model3d: string | undefined;
  if (reg.id === '99_ceo') {
    image = assetUrl(`/portraits/99_CEO/${subFolder}/${pickCeoPortraitName(subFolder)}.webp`);
    const ceoModelPath = pickCeoModelPath(subFolder);
    if (ceoModelPath) model3d = assetUrl(ceoModelPath);
  } else {
    // Pick from the folder's real file count, not a hard-coded 1..20.
    const fileNum = pickPortraitFileNumber(folderName, subFolder).toString().padStart(3, '0');
    const genderCode = gender === 'women' ? 'w' : gender === 'men' ? 'm' : 't';
    image = assetUrl(`/portraits/${folderName}/${subFolder}/portrait${reg.code}${genderCode}_${fileNum}.webp`);
    const modelPath = pickPortraitModelPath(folderName, reg.code, subFolder);
    if (modelPath) model3d = assetUrl(modelPath);
  }

  return {
    id: 'char_' + Math.random().toString(36).substring(2, 9),
    name,
    gender,
    region: reg.id,
    regionName: reg.name,
    country: pickCountry(reg.id),
    city: pickCity(reg.id),
    age: Math.floor(Math.random() * 43) + 18,
    role,
    price,
    skill,
    loyalty: Math.floor(Math.random() * 40) + 60,
    image,
    model3d,
    assignedVenue: 'trade',
    managerialRole: 'none',
    healthLevel: 'Pristine',
    exhaustionLevel: 'Rested',
    exactHealth: 95,
    exactExhaustion: 15,
    headHairStyle: 'Straight Layered',
    headHairLength: 35,
    facialHairStyle: gender === 'men' ? 'Clean Shaven' : 'None',
    pubicHairStyle: 'Natural Trim',
    pubicHairLength: 'Medium',
    tanningLevel: 40,
    skinCondition: 'Clear',
    submission: Math.floor(Math.random() * 50) + 40,
    pleasureStats: {
      vaginalCount: 0,
      analCount: 0,
      totalEarnings: 0
    }
  };
}

export const MARKET_POOL_MIN_SIZE = 1;
export const MARKET_POOL_MAX_SIZE = 10;
export const MARKET_POOL_SIZE = MARKET_POOL_MAX_SIZE;

/**
 * Refreshes the Global Marketplace pool to MARKET_POOL_SIZE operatives.
 *
 * The Global Marketplace fully restocks every week, replacing all candidates
 * not marked for reservation with fresh faces. Reserved, non-acquired candidates
 * occupy their existing slots for one refresh; hired operatives leave the market
 * and live on in the roster.
 */
export function refreshMarketPool(pool: Character[], reservedCharacterIds: string[] = []): Character[] {
  const preserved = pool
    .filter(character => !character.acquired && reservedCharacterIds.includes(character.id))
    .slice(0, MARKET_POOL_SIZE);
  const replacementCount = MARKET_POOL_SIZE - preserved.length;
  const usedImages = new Set(preserved.map(character => character.image));
  const replacements: Character[] = [];
  let guard = 0;
  while (replacements.length < replacementCount && guard < 60) {
    guard++;
    const sourceRegion = pool.length > 0 
      ? pool[Math.floor(Math.random() * pool.length)].region 
      : REGIONS[Math.floor(Math.random() * REGIONS.length)].id;
    
    const fresh = generateCharacter(sourceRegion, undefined);
    
    if (usedImages.has(fresh.image)) continue;
    usedImages.add(fresh.image);
    replacements.push(fresh);
  }
  
  return [...preserved, ...replacements];
}

export function calculateAttractiveness(char: Character): number {
  let score = 50;
  score += (char.headHairLength > 10 ? 15 : 5) + (char.headHairStyle.includes('Layered') || char.headHairStyle.includes('Designer') ? 10 : 0);
  score += char.pubicHairStyle ? 8 : 0;
  score += char.facialHairStyle !== 'None' && char.facialHairStyle !== 'Clean Shaven' ? 5 : 2;
  score += char.tanningLevel > 20 ? 10 : 0;
  score += char.skinCondition === 'Flawless' || char.skinCondition === 'Clear' ? 12 : -5;
  score += Math.floor(char.skill * 0.1);
  return Math.min(100, Math.max(10, score));
}

/**
 * Generates a captured enemy as a slave character. Captured bandits/raiders are
 * broken, low-skill, high-submission operatives suitable for the Pleasure House
 * or menial venues. They are not hired from the marketplace and carry a
 * `slaveOrigin` tag so they can be filtered out of recruitment pools.
 */
export function generateSlaveCharacter(params: {
  regionId: string;
  quality: 'low' | 'medium' | 'high' | 'legendary';
  origin: string;
  name?: string;
}): Character {
  const reg = REGIONS.find(r => r.id === params.regionId) || REGIONS[0];
  const qualityMult = params.quality === 'legendary' ? 1.0 : params.quality === 'high' ? 0.7 : params.quality === 'medium' ? 0.45 : 0.2;
  const skill = Math.max(5, Math.floor((Math.random() * 40 + 20) * qualityMult));
  const price = Math.floor(skill * 120 + Math.random() * 3000);

  const genderRand = Math.random();
  const gender: 'women' | 'men' | 'trans' = genderRand < 0.5 ? 'women' : genderRand < 0.95 ? 'men' : 'trans';
  const nameList = FIRST_NAMES[gender];
  const name = params.name || `${nameList[Math.floor(Math.random() * nameList.length)]} ${LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]}`;

  const folderName = REGION_FOLDERS[reg.id] || DEFAULT_PORTRAIT_FOLDER;
  const subFolder: PortraitSex = gender === 'women' ? 'women' : gender === 'men' ? 'men' : 'trans';
  const fileNum = pickPortraitFileNumber(folderName, subFolder).toString().padStart(3, '0');
  const genderCode = gender === 'women' ? 'w' : gender === 'men' ? 'm' : 't';
  const image = assetUrl(`/portraits/${folderName}/${subFolder}/portrait${reg.code}${genderCode}_${fileNum}.webp`);
  const modelPath = pickPortraitModelPath(folderName, reg.code, subFolder);
  const model3d = modelPath ? assetUrl(modelPath) : undefined;

  const submission = params.quality === 'legendary' ? Math.floor(Math.random() * 15 + 85)
    : params.quality === 'high' ? Math.floor(Math.random() * 25 + 60)
    : params.quality === 'medium' ? Math.floor(Math.random() * 35 + 40)
    : Math.floor(Math.random() * 50 + 20);

  const role = params.quality === 'legendary' ? 'Легендарная добыча (раб)'
    : params.quality === 'high' ? 'Пойманная элита (раб)'
    : params.quality === 'medium' ? 'Пойманный ветеран (раб)'
    : 'Пойманный головорез (раб)';

  return {
    id: 'slave_' + Math.random().toString(36).substring(2, 9),
    name,
    gender,
    region: reg.id,
    regionName: reg.name,
    country: pickCountry(reg.id),
    city: pickCity(reg.id),
    age: Math.floor(Math.random() * 20) + 18,
    role,
    price,
    skill,
    loyalty: Math.floor(Math.random() * 20 + 10),
    image,
    model3d,
    assignedVenue: 'pleasure_house',
    managerialRole: 'none',
    healthLevel: params.quality === 'legendary' ? 'Good' : 'Fair',
    exhaustionLevel: params.quality === 'legendary' ? 'Rested' : 'Tired',
    exactHealth: params.quality === 'legendary' ? 85 : 70,
    exactExhaustion: params.quality === 'legendary' ? 20 : 40,
    headHairStyle: params.quality === 'legendary' ? 'Designer Cut' : 'Short Practical',
    headHairLength: params.quality === 'legendary' ? 45 : 12,
    facialHairStyle: gender === 'men' ? (params.quality === 'legendary' ? 'Styled Beard' : 'Stubble') : 'None',
    pubicHairStyle: params.quality === 'legendary' ? 'Designer Trim' : 'Natural Trim',
    pubicHairLength: params.quality === 'legendary' ? 'Styled' : 'Short',
    tanningLevel: params.quality === 'legendary' ? 60 : Math.floor(Math.random() * 30),
    skinCondition: params.quality === 'legendary' ? 'Flawless' : 'Clear',
    submission,
    pleasureStats: { vaginalCount: 0, analCount: 0, totalEarnings: 0 },
    isSlave: true,
    slaveOrigin: params.origin
  };
}
