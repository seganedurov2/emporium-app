export interface EventChoice {
  text: string;
  fundsDelta?: number;
  reputationDelta?: number;
  resultMessage: string;
  capturedSlaves?: number;
  slaveQuality?: 'low' | 'medium' | 'high';
  caravanDamage?: number;
  /**
   * Custom effect applied to the game state upon choosing this option.
   */
  effect?: (state: any) => any;
  /**
   * When true, this choice opens the slave-auction bidding flow instead of
   * resolving immediately (Idea 4: auction house). The App shows a bid modal.
   */
  startsAuction?: boolean;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  category: 'economy' | 'security' | 'diplomacy' | 'opportunity' | 'crisis';
  choices: EventChoice[];
  /** Condition that must be met for this event to be eligible for selection. */
  condition?: (state: any) => boolean;
  /** Weight for selection; higher values increase the probability. */
  weight?: number;
}

export interface CaravanEvent {
  id: string;
  title: string;
  description: string;
  type: 'raiders' | 'pirates' | 'bandits' | 'weather' | 'wildlife' | 'disease';
  severity: 'minor' | 'moderate' | 'severe';
  choices: CaravanEventChoice[];
}

export interface CaravanEventChoice {
  text: string;
  successChance: number;
  fundsDelta: number;
  reputationDelta: number;
  resultMessage: string;
  failureMessage: string;
  capturedSlaves?: number;
  slaveQuality?: 'low' | 'medium' | 'high';
  caravanDamage?: number;
  crewCasualties?: number;
}

export const RANDOM_EVENTS: GameEvent[] = [
  {
    id: 'event_customs_crackdown',
    title: 'Облава таможенной службы',
    description: 'Имперские таможенники в крупном региональном порту проводят проверку торговых манифестов. Они угрожают конфисковать непроверенный груз, если не будет уплачен значительный сбор или взятка.',
    category: 'security',
    weight: 5,
    choices: [
      {
        text: 'Заплатить взятку ($10,000)',
        fundsDelta: -10000,
        reputationDelta: 0,
        resultMessage: 'Взятка принята. Таможенники пропустили ваш груз без задержек.'
      },
      {
        text: 'Отказаться и апеллировать законным путём (-5 Репутации)',
        fundsDelta: 0,
        reputationDelta: -5,
        resultMessage: 'Апелляции вызвали недельные задержки в порту, нанеся ущерб вашей региональной репутации.'
      }
    ]
  },
  {
    id: 'event_market_boom',
    title: 'Внезапный товарный бум',
    description: 'Беспрецедентный рыночный спрос на предметы роскоши прорвался по всей Западной Европе и Средиземноморью. Ваша торговая сеть занимает уникальное положение для извлечения выгоды.',
    category: 'economy',
    weight: 3,
    choices: [
      {
        text: 'Масштабно инвестировать в транспорт роскоши (+$25,000)',
        fundsDelta: 25000,
        reputationDelta: 3,
        resultMessage: 'Товарный бум реализован! Ваши торговые сети принесли огромную прибыль в $25,000.'
      },
      {
        text: 'Играть безопасно и получить стандартные дивиденды (+$8,000)',
        fundsDelta: 8000,
        reputationDelta: 1,
        resultMessage: 'Получен скромный доход в $8,000 без риска.'
      }
    ]
  },
  {
    id: 'event_smuggler_offer',
    title: 'Предложение теневого контрабандиста',
    description: 'Подпольный синдикат обращается к вашим агентам с предложением использовать секретные морские маршруты, минуя все пошлины ценой потенциальной юридической ответственности.',
    category: 'opportunity',
    weight: 4,
    choices: [
      {
        text: 'Принять подпольное партнерство (+$18,000, -4 Реп)',
        fundsDelta: 18000,
        reputationDelta: -4,
        resultMessage: 'Контрабандный маршрут оказался выгодным (+$18,000), но слухи о синдикате снизили вашу репутацию (-4%).'
      },
      {
        text: 'Отказаться и сообщить о них властям (+5 Реп)',
        fundsDelta: 0,
        reputationDelta: 5,
        resultMessage: 'Предложение отклонено. Местные власти похвалили вашу законопослушную позицию (+5% Репутации).'
      }
    ]
  },
  {
    id: 'event_diplomatic_summit',
    title: 'Региональный торговый саммит',
    description: 'Вы получили приглашение на эксклюзивный торговый саммит среди мировых торговых лидеров. Ваше присутствие может закрепить долгосрочные коммерческие соглашения.',
    category: 'diplomacy',
    weight: 2,
    choices: [
      {
        text: 'Спонсировать банкет и принять делегатов (-$15,000, +8 Реп)',
        fundsDelta: -15000,
        reputationDelta: 8,
        resultMessage: 'Роскошный прием впечатлил делегатов, повысив Репутацию Синдиката на +8%!'
      },
      {
        text: 'Посетить с минимальными расходами (-$3,000, +2 Реп)',
        fundsDelta: -3000,
        reputationDelta: 2,
        resultMessage: 'Скромное участие поддерживало базовые связи.'
      }
    ]
  },
  {
    id: 'event_internal_leak',
    title: 'Внутренняя утечка данных',
    description: 'Один из ваших бухгалтеров был замечен в общении с налоговой инспекцией. Похоже, часть ваших финансовых схем стала известна властям.',
    category: 'crisis',
    weight: 3,
    condition: (state) => state.funds > 500000,
    choices: [
      {
        text: 'Заглушить скандал деньгами (-$40,000)',
        fundsDelta: -40000,
        reputationDelta: 0,
        resultMessage: 'Крупная сумма «пожертвований» заставила инспекторов закрыть глаза на несостыковки.'
      },
      {
        text: 'Попытаться скрыть следы (-10 Репутации)',
        fundsDelta: 0,
        reputationDelta: -10,
        resultMessage: 'Попытка скрыть данные провалилась, что вызвало волну подозрений в деловых кругах.'
      },
      {
        text: 'Сдать бухгалтера властям (+$5,000, -5 Реп)',
        fundsDelta: 5000,
        reputationDelta: -5,
        resultMessage: 'Вы представили бухгалтера как «одинокого предателя», получив небольшую награду, но потеряв лицо.'
      }
    ]
  },
  {
    id: 'event_rare_talent',
    title: 'Обнаружение редкого таланта',
    description: 'Ваши агенты нашли оперативника с уникальным сочетанием навыков, который ищет покровительства. Он готов присоединиться к Синдикату при условии достойной оплаты.',
    category: 'opportunity',
    weight: 2,
    choices: [
      {
        text: 'Выплатить премиальный контракт (-$20,000)',
        fundsDelta: -20000,
        reputationDelta: 2,
        resultMessage: 'Талант привлечён! В ростер добавлен высококвалифицированный оперативник.',
        effect: (state) => {
          // Logic handled in App.tsx via a signal or by adding a character here if state is passed
          return state;
        }
      },
      {
        text: 'Игнорировать предложение',
        fundsDelta: 0,
        reputationDelta: 0,
        resultMessage: 'Вы решили не рисковать бюджетом.'
      }
    ]
  },
  {
    id: 'event_police_raid',
    title: 'Полицейский рейд',
    description: 'Местные власти провели внезапную проверку одного из ваших филиалов. Они требуют «компенсацию» за нарушение санитарных норм и лицензий.',
    category: 'security',
    weight: 4,
    choices: [
      {
        text: 'Заплатить штраф ($15,000)',
        fundsDelta: -15000,
        reputationDelta: -2,
        resultMessage: 'Штраф уплачен. Полиция покидает здание, но оставила пометку о проверке.'
      },
      {
        text: 'Использовать связи в мэрии (-5 Реп)',
        fundsDelta: 0,
        reputationDelta: -5,
        resultMessage: 'Звонок влиятельному другу помог избежать штрафа, но ваша репутация среди честных бизнесменов упала.'
      }
    ]
  },
  {
    id: 'event_regional_conflict',
    title: 'Региональный конфликт',
    description: 'В одном из ваших ключевых регионов разразились беспорядки. Логистика нарушена, а риски для караванов резко возросли.',
    category: 'crisis',
    weight: 3,
    choices: [
      {
        text: 'Усилить охрану маршрутов (-$10,000)',
        fundsDelta: -10000,
        reputationDelta: 0,
        resultMessage: 'Дополнительные конвои обеспечили безопасность грузов.'
      },
      {
        text: 'Приостановить торговлю в регионе (-5,000 доход)',
        fundsDelta: -5000,
        reputationDelta: 0,
        resultMessage: 'Вы временно вывели активы из зоны конфликта, избежав потерь.'
      }
    ]
  }
];

export function getRandomEvent(state: any): GameEvent {
  const eligibleEvents = RANDOM_EVENTS.filter(event => !event.condition || event.condition(state));
  const pool = eligibleEvents.length > 0 ? eligibleEvents : RANDOM_EVENTS;
  
  const totalWeight = pool.reduce((sum, event) => sum + (event.weight ?? 1), 0);
  let random = Math.random() * totalWeight;
  
  for (const event of pool) {
    random -= (event.weight ?? 1);
    if (random <= 0) return event;
  }
  return pool[0];
}

/**
 * The recurring slave-auction event (Idea 4). Its choices don't resolve directly:
 * the App intercepts them and runs a bid mini-flow against NPC buyers.
 */
export const AUCTION_EVENT: GameEvent = {
  id: 'event_slave_auction',
  title: 'Подпольный рабский аукцион',
  description: 'Теневой аукционный дом ликвидирует конфискованную партию пленников тому, кто предложит больше. Покупатели-NPC уже кружат. Вы можете войти в торги — выиграете, и элитный пленник пополнит ваш состав; проиграете, и ваше время и залог будут потрачены впустую.',
  category: 'opportunity',
  choices: [
    {
      text: 'Войти на подпольный рабский аукцион',
      fundsDelta: 0,
      reputationDelta: 0,
      resultMessage: 'Вы входите в аукционный дом и делаете ставку.',
      startsAuction: true
    },
    {
      text: 'Уйти с аукциона (-0 Репутации)',
      fundsDelta: 0,
      reputationDelta: 0,
      resultMessage: 'Вы отказываетесь делать ставку. Лот уходит другому покупателю.'
    }
  ]
};

/**
 * Returns a random event, with a recurring slave auction every four weeks.
 * Expansion event variants are selected by expansionEventsEngine.ts to keep this
 * existing legacy event API and auction handoff intact.
 */
export function getRandomEventWithAuction(week: number): GameEvent {
  if (week % 4 === 0) return AUCTION_EVENT;
  return getRandomEvent({} as any);
}
