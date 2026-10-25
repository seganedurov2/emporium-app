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
  },
};

export const getTerm = (term: keyof TerminologyMap, platform: Platform = 'original') => {
  return TERMINOLOGY[platform][term];
};
