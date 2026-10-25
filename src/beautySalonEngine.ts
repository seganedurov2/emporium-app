export interface TreatmentType {
  id: string;
  name: string;
  category: 'hair_color' | 'hair_length' | 'hairstyle' | 'facial_hair' | 'body_hair' | 'tanning' | 'skin';
  baseCost: number;
  timeHours: number;
  suppliesConsumed: number;
  description: string;
}

export const TREATMENTS: TreatmentType[] = [
  { id: 't_hair_color', name: 'Профессиональное окрашивание волос', category: 'hair_color', baseCost: 150, timeHours: 2, suppliesConsumed: 3, description: 'Премиальное окрашивание в яркие или естественные оттенки.' },
  { id: 't_hair_length', name: 'Наращивание и укладка волос', category: 'hair_length', baseCost: 200, timeHours: 3, suppliesConsumed: 4, description: 'Наращивание длины и структурная укладка.' },
  { id: 't_hairstyle', name: 'Стрижка и укладка от дизайнера', category: 'hairstyle', baseCost: 120, timeHours: 1.5, suppliesConsumed: 2, description: 'Современная стрижка и укладка.' },
  { id: 't_facial_hair', name: 'Уход за бородой и лицом', category: 'facial_hair', baseCost: 90, timeHours: 1, suppliesConsumed: 1, description: 'Точное подстригание, бритьё и уход за кожей.' },
  { id: 't_body_hair', name: 'Уход за телом и интимной зоной', category: 'body_hair', baseCost: 180, timeHours: 2.5, suppliesConsumed: 4, description: 'Полное гладкое удаление волос и уход за кожей.' },
  { id: 't_tanning', name: 'Загар в солярии / spray-тан', category: 'tanning', baseCost: 110, timeHours: 1, suppliesConsumed: 2, description: 'Золотисто-бронзовый загар.' },
  { id: 't_skin_condition', name: 'Омолаживающий уход за лицом', category: 'skin', baseCost: 220, timeHours: 2, suppliesConsumed: 3, description: 'Глубокая очистка, пилинг и увлажнение.' }
];

export interface ManagerTrait {
  id: string;
  name: string;
  effectDescription: string;
  capacityBonus: number;
  clientBonus: number;
  tipBonus: number;
  costModifier: number;
}

export const MANAGER_TRAITS: ManagerTrait[] = [
  { id: 'mt_master_stylist', name: 'Мастер-стилист', effectDescription: '+25% к удовлетворённости клиентов и чаевым', capacityBonus: 0, clientBonus: 0.15, tipBonus: 0.25, costModifier: 1.0 },
  { id: 'mt_efficient_supply', name: 'Оптимизатор расходников', effectDescription: '-20% к стоимости расходников для процедур', capacityBonus: 0, clientBonus: 0, tipBonus: 0, costModifier: 0.8 },
  { id: 'mt_high_capacity', name: 'Руководитель по потоку', effectDescription: '+2 рабочих места', capacityBonus: 2, clientBonus: 0.2, tipBonus: 0, costModifier: 1.1 },
  { id: 'mt_charisma', name: 'Обаятельный хозяин', effectDescription: '+30% к притоку внешних клиентов', capacityBonus: 0, clientBonus: 0.3, tipBonus: 0.1, costModifier: 1.05 },
  { id: 'mt_frugal', name: 'Строгий бухгалтер', effectDescription: '-15% к операционным расходам салона', capacityBonus: 0, clientBonus: -0.05, tipBonus: 0, costModifier: 0.85 },
  { id: 'mt_perfectionist', name: 'Стандарты перфекциониста', effectDescription: '+40% к чаевым, +10% к расходу расходников', capacityBonus: 0, clientBonus: 0.1, tipBonus: 0.4, costModifier: 1.1 },
  { id: 'mt_fast_paced', name: 'Мастер скорости', effectDescription: '-30% к времени проведения процедур', capacityBonus: 1, clientBonus: 0.1, tipBonus: 0, costModifier: 1.0 },
  { id: 'mt_networker', name: 'VIP-контакты', effectDescription: 'Привлекает состоятельных клиентов из селебрити', capacityBonus: 0, clientBonus: 0.25, tipBonus: 0.2, costModifier: 1.15 }
];

export interface SalonLevel {
  level: number;
  name: string;
  workstations: number;
  upgradeCost: number;
  supplyCapacity: number;
}

export const SALON_LEVELS: SalonLevel[] = [
  { level: 1, name: 'Бутик-студия', workstations: 2, upgradeCost: 0, supplyCapacity: 100 },
  { level: 2, name: 'Стандартный салон красоты', workstations: 4, upgradeCost: 35000, supplyCapacity: 250 },
  { level: 3, name: 'Люксовый велнес-центр', workstations: 8, upgradeCost: 85000, supplyCapacity: 600 },
  { level: 4, name: 'Имперский спа и салон', workstations: 15, upgradeCost: 200000, supplyCapacity: 1500 }
];

export interface ScheduledTreatment {
  id: string;
  characterId: string;
  characterName: string;
  treatmentId: string;
  treatmentName: string;
  isAutomatic: boolean;
  intervalWeeks: number; // e.g. every 2 weeks
  nextRunWeek: number;
  status: 'queued' | 'in_progress' | 'completed';
}

export interface BeautySalonState {
  level: number;
  managerId: string | null;
  managerTraitId: string | null;
  supplies: number;
  scheduledTreatments: ScheduledTreatment[];
  totalRevenue: number;
}
