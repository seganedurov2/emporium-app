export type Platform = 'original' | 'tiktok';

export interface TerminologyMap {
  slaves: string;
  captives: string;
  pleasureHouse: string;
  bdsmRoom: string;
  breaking: string;
  submission: string;
  discipline: string;
  operative: string;
  slave_fem: string;
  slave_masc: string;
  prisoner: string;
  prisoners: string;
  pleasure_house: string;
  strip_club: string;
  beauty_salon: string;
  bdsm_room: string;
  objects: string;
  lot: string;
  lots: string;
  captive_lots: string;
  regional_purchase: string;
  market_entry_story: string;
}

export const TERMINOLOGY: Record<Platform, TerminologyMap> = {
  original: {
    slaves: 'пленники',
    captives: 'пленные',
    pleasureHouse: 'дом удовольствий',
    bdsmRoom: 'БДСМ-комната',
    breaking: 'умиротворение',
    submission: 'покорность',
    discipline: 'дисциплина',
    operative: 'оперативник',
    slave_fem: 'рабыня',
    slave_masc: 'раб',
    prisoner: 'пленник',
    prisoners: 'пленники',
    pleasure_house: 'дом удовольствий',
    strip_club: 'стрип-клуб',
    beauty_salon: 'салон красоты',
    bdsm_room: 'Исправительный Центр',
    objects: 'предметы',
    lot: 'лот',
    lots: 'лоты',
    captive_lots: 'партии пленных',
    regional_purchase: 'региональная закупка',
    market_entry_story: 'биография поступления',
  },
  tiktok: {
    slaves: 'специалисты',
    captives: 'кандидаты',
    pleasureHouse: 'центр отдыха',
    bdsmRoom: 'студия коучинга',
    breaking: 'обучение',
    submission: 'профессионализм',
    discipline: 'корпоративная этика',
    operative: 'сотрудник',
    slave_fem: 'специалистка',
    slave_masc: 'специалист',
    prisoner: 'кандидат',
    prisoners: 'кандидаты',
    pleasure_house: 'центр отдыха',
    strip_club: 'клуб',
    beauty_salon: 'салон',
    bdsm_room: 'тренинговый центр',
    objects: 'инструменты',
    lot: 'партия',
    lots: 'партии',
    captive_lots: 'партии кандидатов',
    regional_purchase: 'региональная закупка',
    market_entry_story: 'история поступления',
  },
};

export const getTerm = (term: keyof TerminologyMap | string, platform: Platform = 'original') => {
  if (typeof term === 'string' && !(term in TERMINOLOGY[platform])) {
    return term;
  }
  return TERMINOLOGY[platform][term as keyof TerminologyMap];
};
