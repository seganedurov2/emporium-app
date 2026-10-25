import type { ExpansionEvent } from '../expansionTypes';

/**
 * New facilities and employee events. Every event declares campaign conditions;
 * the resolver only offers events that match the current save.
 */
export const EXPANSION_EVENTS: ExpansionEvent[] = [
  {
    kind: 'expansion',
    id: 'expansion_local_education_grant',
    title: 'Грант на профессиональное обучение',
    description: 'Региональный фонд развития предлагает поддержать корпоративное обучение. Деньги можно направить на улучшение учебной инфраструктуры.',
    category: 'education',
    conditions: [{ minWeek: 3 }],
    choices: [
      { id: 'accept', text: 'Принять грант (+$8 000, +2 репутации)', resultMessage: 'Фонд перечислил грант на развитие обучения.', effects: [{ type: 'funds', delta: 8000 }, { type: 'reputation', delta: 2 }] },
      { id: 'decline', text: 'Отказаться от предложения (+1 репутация)', resultMessage: 'Компания поблагодарила фонд за предложение и укрепила деловые связи.', effects: [{ type: 'reputation', delta: 1 }] }
    ]
  },
  {
    kind: 'expansion',
    id: 'expansion_school_audit',
    title: 'Проверка школьной программы',
    description: 'Проверяющий предлагает аудит курсов и расписания. Исправления займут ресурсы, но помогут сотрудникам учиться эффективнее.',
    category: 'education',
    conditions: [{ buildingId: 'school', minBuildingLevel: 1 }],
    choices: [
      { id: 'audit', text: 'Оплатить аудит (-$4 000, +3 репутации)', resultMessage: 'Аудит помог улучшить программу обучения.', effects: [{ type: 'funds', delta: -4000 }, { type: 'reputation', delta: 3 }] },
      { id: 'defer', text: 'Отложить проверку', resultMessage: 'Проверку программы перенесли на следующий период.', effects: [] }
    ]
  },
  {
    kind: 'expansion',
    id: 'expansion_guest_lecturer',
    title: 'Приглашённый лектор',
    description: 'Опытный преподаватель предлагает провести открытую лекцию для команды и поделиться материалами курса.',
    category: 'education',
    conditions: [{ employeeSpecialty: 'teacher' }],
    choices: [
      { id: 'host', text: 'Организовать лекцию (-$2 500, опыт преподавателей)', resultMessage: 'Сотрудники получили практические материалы и опыт.', effects: [{ type: 'funds', delta: -2500 }, { type: 'employeeExperience', delta: 30, specialty: 'teacher' }] },
      { id: 'pass', text: 'Вежливо отказаться', resultMessage: 'Лекцию решили провести в другой раз.', effects: [] }
    ]
  },
  {
    kind: 'expansion',
    id: 'expansion_course_materials',
    title: 'Срочная закупка учебных материалов',
    description: 'Поставщик предлагает комплект материалов со скидкой. Школа сможет использовать их уже на следующей неделе.',
    category: 'education',
    conditions: [{ buildingId: 'school', minBuildingLevel: 1, minFunds: 2500 }],
    choices: [
      { id: 'purchase', text: 'Купить комплект (-$2 500, опыт преподавателей)', resultMessage: 'Учебные материалы поступили в школу.', effects: [{ type: 'funds', delta: -2500 }, { type: 'employeeExperience', delta: 25, specialty: 'teacher' }] },
      { id: 'skip', text: 'Не покупать', resultMessage: 'Школа продолжит работать с текущими материалами.', effects: [] }
    ]
  },
  {
    kind: 'expansion',
    id: 'expansion_clinic_supply_delivery',
    title: 'Поставка медицинских расходников',
    description: 'Клиника может заказать дополнительный запас базовых медицинских материалов по фиксированной цене.',
    category: 'wellness',
    conditions: [{ buildingId: 'clinic', minBuildingLevel: 1, minFunds: 3000 }],
    choices: [
      { id: 'order', text: 'Заказать расходники (-$3 000, +2 репутации)', resultMessage: 'Поставка поступила в клинику, а партнёры отметили качество сервиса.', effects: [{ type: 'funds', delta: -3000 }, { type: 'reputation', delta: 2 }] },
      { id: 'wait', text: 'Дождаться обычной поставки', resultMessage: 'Клиника дождётся планового пополнения запасов.', effects: [] }
    ]
  },
  {
    kind: 'expansion',
    id: 'expansion_clinic_community_day',
    title: 'День профилактических осмотров',
    description: 'Местное сообщество предлагает совместно провести день профилактики. Участие требует времени медицинского специалиста.',
    category: 'wellness',
    conditions: [{ buildingId: 'clinic', minBuildingLevel: 1, employeeSpecialty: 'clinician' }],
    choices: [
      { id: 'participate', text: 'Участвовать (+$3 500, +4 репутации)', resultMessage: 'Партнёрство расширило сеть клиники и принесло доход.', effects: [{ type: 'funds', delta: 3500 }, { type: 'reputation', delta: 4 }] },
      { id: 'decline', text: 'Отказаться от участия', resultMessage: 'Клиника сохранила расписание без изменений.', effects: [] }
    ]
  },
  {
    kind: 'expansion',
    id: 'expansion_clinician_symposium',
    title: 'Медицинский симпозиум',
    description: 'Клинициста пригласили на профессиональную встречу. Компания может оплатить поездку и повысить квалификацию специалиста.',
    category: 'wellness',
    conditions: [{ employeeSpecialty: 'clinician' }],
    choices: [
      { id: 'send', text: 'Оплатить участие (-$3 000, опыт клиницистов)', resultMessage: 'Сотрудник вернулся с новыми практическими знаниями.', effects: [{ type: 'funds', delta: -3000 }, { type: 'employeeExperience', delta: 35, specialty: 'clinician' }] },
      { id: 'decline', text: 'Отказаться', resultMessage: 'Специалист продолжил работу по текущему плану.', effects: [] }
    ]
  },
  {
    kind: 'expansion',
    id: 'expansion_coaching_workshop',
    title: 'Практикум по развитию команды',
    description: 'Коуч предлагает провести короткий практикум по постановке целей и работе с нагрузкой.',
    category: 'wellness',
    conditions: [{ buildingId: 'self_development_center', minBuildingLevel: 1, employeeSpecialty: 'coach' }],
    choices: [
      { id: 'run', text: 'Провести практикум (+$1 000, +5 морали сотрудников)', resultMessage: 'Команда согласовала план развития и улучшила рабочее взаимодействие.', effects: [{ type: 'funds', delta: 1000 }, { type: 'employeeMorale', delta: 5 }] },
      { id: 'later', text: 'Перенести на следующую неделю', resultMessage: 'Практикум перенесли без дополнительных расходов.', effects: [] }
    ]
  },
  {
    kind: 'expansion',
    id: 'expansion_mentor_network',
    title: 'Сеть наставников',
    description: 'Деловое объединение предлагает обмен наставниками для специалистов, работающих в центре саморазвития.',
    category: 'operations',
    conditions: [{ buildingId: 'self_development_center', minBuildingLevel: 1 }],
    choices: [
      { id: 'join', text: 'Вступить в сеть (+3 морали, опыт коучей)', resultMessage: 'Центр подключился к сети профессионального обмена.', effects: [{ type: 'employeeMorale', delta: 3 }, { type: 'employeeExperience', delta: 20, specialty: 'coach' }] },
      { id: 'decline', text: 'Пока не вступать', resultMessage: 'Компания решила вернуться к предложению позднее.', effects: [] }
    ]
  },
  {
    kind: 'expansion',
    id: 'expansion_facility_inspection',
    title: 'Проверка вспомогательных помещений',
    description: 'Инспектор нашёл несколько небольших несоответствий в обслуживании здания. Можно исправить их сейчас или дождаться следующей проверки.',
    category: 'operations',
    conditions: [{ minWeek: 6, buildingId: 'school', minBuildingLevel: 1 }],
    choices: [
      { id: 'fix', text: 'Исправить замечания (-$2 000, +2 репутации)', resultMessage: 'Замечания устранены, здание прошло повторную проверку.', effects: [{ type: 'funds', delta: -2000 }, { type: 'reputation', delta: 2 }] },
      { id: 'defer', text: 'Отложить работы (-2 репутации)', resultMessage: 'Отсрочка сэкономила средства, но вызвала вопросы партнёров.', effects: [{ type: 'reputation', delta: -2 }] }
    ]
  },
  {
    kind: 'expansion',
    id: 'expansion_employee_award',
    title: 'Признание профессиональных заслуг',
    description: 'Партнёры отметили результаты одного из штатных специалистов и предлагают небольшую премию за командный вклад.',
    category: 'opportunity',
    conditions: [{ minWeek: 5, employeeSpecialty: 'teacher' }],
    choices: [
      { id: 'bonus', text: 'Выдать премию (-$1 500, +8 морали)', resultMessage: 'Премия отмечена сотрудником как признание вклада команды.', effects: [{ type: 'funds', delta: -1500 }, { type: 'employeeMorale', delta: 8, specialty: 'teacher' }] },
      { id: 'recognize', text: 'Поблагодарить публично (+2 репутации)', resultMessage: 'Партнёры положительно оценили вклад команды.', effects: [{ type: 'reputation', delta: 2 }] }
    ]
  }
];
