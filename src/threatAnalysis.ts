/**
 * Threat analysis and protection methods for automated warehouse
 * management systems (WMS / distributed warehouse complexes).
 *
 * Based on the threat model of distributed logistics IT: radio-channel
 * devices (RFID terminals, barcode scanners), multi-node WebSocket /
 * HTTP APIs, cloud-synced saves, third-party integrations (carriers,
 * customs, marketplaces) and insider access at the warehouse.
 *
 * Each threat lists the protection methods that mitigate it, and each
 * protection method references the `dataProtection` settings it depends
 * on (see `src/dataProtection.ts`).
 */

export type ThreatSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ThreatCategory =
  | 'access'
  | 'interception'
  | 'tampering'
  | 'availability'
  | 'physical'
  | 'supply_chain'
  | 'insider';

export interface ProtectionMethod {
  id: string;
  name: string;
  description: string;
  dependsOn?: ('encryption_at_rest' | 'tls_wss' | 'audit_log')[];
  implemented: boolean;
}

export interface Threat {
  id: string;
  title: string;
  category: ThreatCategory;
  severity: ThreatSeverity;
  description: string;
  attackVector: string;
  impact: string;
  protections: string[];
  regulatory?: string;
}

export const PROTECTION_METHODS: ProtectionMethod[] = [
  {
    id: 'enc_at_rest',
    name: 'Шифрование при хранении',
    description: 'AES-256-GCM шифрование сохранений campaigns и настроек перед записью в localStorage. Ключ выводится из пароля пользователя через PBKDF2 (250 000 итераций).',
    dependsOn: ['encryption_at_rest'],
    implemented: true
  },
  {
    id: 'tls_wss',
    name: 'TLS / WSS для всех соединений',
    description: 'Все multiplayer- и API-соединения работают только по wss:// / https://. ws:// автоматически обновляется до wss:// при включённой опции.',
    dependsOn: ['tls_wss'],
    implemented: true
  },
  {
    id: 'audit_log',
    name: 'Журнал аудита доступа к данным',
    description: 'Каждое чтение/запись защищённых данных фиксируется с временной меткой (последние 500 событий хранятся локально).',
    dependsOn: ['audit_log'],
    implemented: true
  },
  {
    id: 'rbac',
    name: 'Ролевая модель доступа (RBAC)',
    description: 'Сотрудники получают доступ только к постам и складам своей специальности и региона. Административные действия требуют отдельной роли.',
    implemented: false
  },
  {
    id: 'mfa',
    name: 'Двухфакторная аутентификация',
    description: 'Вход в административную панель и изменение критических настроек требуют подтверждения через второй канал.',
    implemented: false
  },
  {
    id: 'network_segmentation',
    name: 'Сегментация сети склада',
    description: 'Терминалы сбора данных, RFID-читы и сервер WMS вынесены в отдельный VLAN, изолированный от гостевого Wi-Fi и интернет-шлюза.',
    implemented: false
  },
  {
    id: 'signed_firmware',
    name: 'Проверка подписи прошивки оборудования',
    description: 'Все сканеры, RFID-читы и контроллеры мезонина загружают только подписанную прошивку; несанкционированные устройства не присоединяются к сети.',
    implemented: false
  },
  {
    id: 'offsite_backup',
    name: 'Зашифрованные резервные копии вне сайта',
    description: 'Ежедневные бэкапы базы WMS шифруются и копируются на удалённый узел с отдельным ключом доступа.',
    implemented: false
  },
  {
    id: 'penetration_testing',
    name: 'Регулярное тестирование на проникновение',
    description: 'Ежеквартальный аудит внешнего и внутреннего периметра WMS, включая беспроводные каналы склада.',
    implemented: false
  },
  {
    id: 'physical_access_control',
    name: 'Контроль физического доступа',
    description: 'Серверная и сетевые шкафы на складе находятся в закрытых помещениях с контролем доступа по пропускам.',
    implemented: false
  }
];

export const THREATS: Threat[] = [
  {
    id: 'T01',
    title: 'Несанкционированный доступ к WMS со склада',
    category: 'access',
    severity: 'critical',
    description: 'Сотрудник или посетитель склада получает доступ к терминалу сбора данных или рабочему месту оператора без аутентификации и просматривает/изменяет остатки, заказы, маршруты.',
    attackVector: 'Физический доступ к терминалу / рабочей станции; отсутствие блокировки экрана.',
    impact: 'Кража коммерческой тайны, подделка остатков, фальсификация отгрузок.',
    protections: ['rbac', 'mfa', 'physical_access_control', 'audit_log'],
    regulatory: '123-ФЗ ст. 78 (СТУ); МЧС М-АМ-136'
  },
  {
    id: 'T02',
    title: 'Перехват данных по радиоканалу (RFID / Wi-Fi терминалы)',
    category: 'interception',
    severity: 'high',
    description: 'Трафик между RFID-читывателями, терминалами и сервером WMS передаётся открыто и может быть перехвачен attacker’ом в радиусе действия радиоканала.',
    attackVector: 'Сниффинг Wi-Fi / RFID-канала; злонамеренная точка доступа (evil twin).',
    impact: 'Утечка номенклатуры, остатков, путей перемещения грузов; перехват учётных данных.',
    protections: ['tls_wss', 'network_segmentation', 'signed_firmware'],
    regulatory: '123-ФЗ ст. 78 (СТУ)'
  },
  {
    id: 'T03',
    title: 'Подмена данных на канале связи (MITM)',
    category: 'tampering',
    severity: 'high',
    description: 'Атакующий между терминалом и сервером WMS подменяет команды отгрузки, адреса или количества груза.',
    attackVector: 'ARP-spoofing, подмена DNS, злонамеренный шлюз в сети склада.',
    impact: 'Отгрузка не того товара, ошибки в складской картотеке, финансовые потери.',
    protections: ['tls_wss', 'network_segmentation'],
    regulatory: '123-ФЗ ст. 78 (СТУ)'
  },
  {
    id: 'T04',
    title: 'Отказ в обслуживании (DoS) сервера WMS',
    category: 'availability',
    severity: 'high',
    description: 'Перегрузка сервера WMS или сетевого канала приводит к остановке приёма, отгрузки и инвентаризации на складе.',
    attackVector: 'Сетевой флуд, перегрузка радиоэфира, отключение питания сетевого оборудования.',
    impact: 'Простой склада, срыв сроков отгрузки, убытки.',
    protections: ['network_segmentation', 'offsite_backup', 'penetration_testing'],
    regulatory: ''
  },
  {
    id: 'T05',
    title: 'Кража резервных копий базы WMS',
    category: 'access',
    severity: 'medium',
    description: 'Незашифрованная резервная копия базы хранится на внешнем носителе или в облаке без защиты и копируется attacker’ом.',
    attackVector: 'Фитическая кража носителя, несанкционированный скачивание из облака.',
    impact: 'Полная утечка базы клиентов, контрактов, цен, персональных данных.',
    protections: ['enc_at_rest', 'offsite_backup', 'physical_access_control'],
    regulatory: '123-ФЗ ст. 78 (СТУ)'
  },
  {
    id: 'T06',
    title: 'Внутренний нарушитель (инсайдер)',
    category: 'insider',
    severity: 'critical',
    description: 'Сотрудник склада с легитимным доступом умышленно изменяет остатки, создаёт фиктивные отгрузки или передаёт данные конкурентам.',
    attackVector: 'Злоупотребление привилегиями; сговор с внешним атакующим.',
    impact: 'Потери товара, искажение отчётности, утечка коммерческой тайны.',
    protections: ['rbac', 'audit_log', 'mfa', 'physical_access_control'],
    regulatory: '123-ФЗ ст. 78 (СТУ)'
  },
  {
    id: 'T07',
    title: 'Компрометация интеграции с перевозчиками и таможней',
    category: 'supply_chain',
    severity: 'high',
    description: 'API или обмен файлами с внешними перевозчиками, таможенными системами и маркетплейсами взломан; поддельные накладные принимаются системой.',
    attackVector: 'Взлом контрагента, подмена файлов обмена, перехват API-ключей.',
    impact: 'Приём несуществующего груза, задержка на таможне, юридические последствия.',
    protections: ['tls_wss', 'rbac', 'audit_log', 'penetration_testing'],
    regulatory: '123-ФЗ ст. 78 (СТУ)'
  },
  {
    id: 'T08',
    title: 'Взлом IoT-оборудования склада (контроллеры мезонина, конвейеры)',
    category: 'physical',
    severity: 'medium',
    description: 'Контроллеры мезонинных подъёмников, конвейерных линий и климатического оборудования подключены к общей сети без изоляции и могут быть перехвачены.',
    attackVector: 'Незащищённый сетевой порт, устаревшая прошивка, пароль по умолчанию.',
    impact: 'Остановка оборудования, повреждение груза, травма персонала.',
    protections: ['network_segmentation', 'signed_firmware', 'physical_access_control'],
    regulatory: 'МЧС М-АМ-136 (пожарная безопасность мезонинов)'
  },
  {
    id: 'T09',
    title: 'Утечка данных через несанкционированное бэкапирование на сторонние носители',
    category: 'access',
    severity: 'medium',
    description: 'Сотрудник копирует базу WMS на флешку или личный облачный диск без согласования.',
    attackVector: 'USB-носитель, личный аккаунт облачного хранилища, электронная почта.',
    impact: 'Утечка коммерческой тайны, персональных данных сотрудников и клиентов.',
    protections: ['enc_at_rest', 'audit_log', 'physical_access_control'],
    regulatory: '123-ФЗ ст. 78 (СТУ)'
  },
  {
    id: 'T10',
    title: 'Подделка учётных данных (credential stuffing / брутфорс)',
    category: 'access',
    severity: 'medium',
    description: 'Атакующий подбирает пароли к учётным записям WMS, используя утекшие из других сервисов комбинации логин/пароль.',
    attackVector: 'Автоматизированный перебор паролей через веб-интерфейс или API.',
    impact: 'Несанкционированный доступ к складу, изменение заказов, кража данных.',
    protections: ['mfa', 'rbac', 'audit_log'],
    regulatory: ''
  }
];

export function threatById(id: string): Threat | undefined {
  return THREATS.find(t => t.id === id);
}

export function protectionById(id: string): ProtectionMethod | undefined {
  return PROTECTION_METHODS.find(p => p.id === id);
}

export function threatsByCategory(category: ThreatCategory): Threat[] {
  return THREATS.filter(t => t.category === category);
}

export function threatsBySeverity(severity: ThreatSeverity): Threat[] {
  return THREATS.filter(t => t.severity === severity);
}

export function protectionsForThreat(threatId: string): ProtectionMethod[] {
  const threat = threatById(threatId);
  if (!threat) return [];
  return threat.protections.map(id => protectionById(id)).filter(Boolean) as ProtectionMethod[];
}

export function severityRank(severity: ThreatSeverity): number {
  return { low: 0, medium: 1, high: 2, critical: 3 }[severity] ?? 0;
}

export function allProtectionsImplemented(): boolean {
  return PROTECTION_METHODS.every(p => p.implemented);
}

export function implementedProtectionIds(): string[] {
  return PROTECTION_METHODS.filter(p => p.implemented).map(p => p.id);
}
