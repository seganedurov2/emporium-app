export interface ClientContract {
  id: string;
  clientName: string;
  title: string;
  description: string;
  rewardFunds: number;
  rewardReputation: number;
  requiredAttractiveness: number;
  durationWeeks: number;
  weeksRemaining: number;
  status: 'active' | 'completed' | 'failed';
  assignedOperativeIds: string[];
  failedReason?: string;
}

export const SAMPLE_CONTRACTS: ClientContract[] = [
  {
    id: 'contract_vip_01',
    title: 'Прием элитного общества',
    clientName: 'Лорд Алистер Стерлинг',
    description: 'Предоставить элитную делегацию опрятных, высококвалифицированных оперативников для представления интересов синдиката на эксклюзивном европейском приеме.',
    rewardFunds: 45000,
    rewardReputation: 12,
    requiredAttractiveness: 70,
    durationWeeks: 3,
    weeksRemaining: 3,
    status: 'active',
    assignedOperativeIds: []
  },
  {
    id: 'contract_vip_02',
    title: 'Организация дипломатического торгового саммита',
    clientName: 'Министр Кадзуя Танака',
    description: 'Принимать почетных гостей с безупречным ухоженным стилем и безупречным гостеприимством.',
    rewardFunds: 60000,
    rewardReputation: 18,
    requiredAttractiveness: 80,
    durationWeeks: 4,
    weeksRemaining: 4,
    status: 'active',
    assignedOperativeIds: []
  }
];

export function generateContract(): ClientContract {
  const names = ['Герцогиня Вивьен', 'Магнат Эрик Вэнс', 'Консул Маркус Торн', 'Посол Линь Чжао'];
  const titles = ['Эксклюзивный частный банкет', 'Морской круиз для VIP', 'Грандиозное открытие курорта люкс', 'Государственный прием'];
  const name = names[Math.floor(Math.random() * names.length)];
  const title = titles[Math.floor(Math.random() * titles.length)];
  const reward = Math.floor(Math.random() * 30000) + 30000;

  return {
    id: 'contract_' + Math.random().toString(36).substring(2, 9),
    clientName: name,
    title,
    description: `Предоставить квалифицированных и ухоженных оперативников для ${title.toLowerCase()} от имени ${name}.`,
    rewardFunds: reward,
    rewardReputation: Math.floor(reward / 5000),
    requiredAttractiveness: 65 + Math.floor(Math.random() * 20),
    durationWeeks: 3,
    weeksRemaining: 3,
    status: 'active',
    assignedOperativeIds: []
  };
}
