import {
  BedDouble, Brain, Building2, Bitcoin, FileText, Gavel, GraduationCap, Handshake, HeartPulse, Landmark, MessageSquare, Scissors,   ShieldAlert, ShoppingCart,
  Target, TrendingUp, Truck, UserPlus, Warehouse, Users, UserCog, UserRound, Music, Trophy, ShieldCheck, Zap, Gamepad2, AlertTriangle, Flame, Settings
} from 'lucide-react';

export type AppTab =
  | 'dashboard'
  | 'market'
  | 'roster'
  | 'caravans'
  | 'capture_ops'
  | 'security_service'
  | 'bdsm_room'
  | 'hospital'
  | 'rest_zone'
  | 'salon'
  | 'facilities_staff'
  | 'staff'
  | 'hiring'
  | 'slave_market'
  | 'supply_contracts'
  | 'contracts'
  | 'auction_house'
  | 'board'
  | 'finances'
  | 'regions'
  | 'pleasure_house_prisoners'
  | 'trait_chats'
  | 'strip_club'
  | 'school_kindergarten'
  | 'school'
  | 'correction_center'
  | 'self_development'
  | 'meta'
  | 'mezzanine'
  | 'warehouse_mezzanine'
  | 'mezzanine_journal'
  | 'boiler_house'
  | 'wasteland'
  | 'game_control';

export const APP_NAVIGATION: { id: AppTab; label: string; icon: typeof TrendingUp }[] = [
  { id: 'dashboard', label: 'Командный центр', icon: TrendingUp },
  { id: 'market', label: 'Глобальный рынок', icon: ShoppingCart },
  { id: 'roster', label: 'Дом удовольствия', icon: Users },
  { id: 'pleasure_house_prisoners', label: 'Пленники ДУ', icon: UserRound },
  { id: 'trait_chats', label: 'Чаты по чертам', icon: MessageSquare },
  { id: 'strip_club', label: 'Стрип-клуб', icon: Music },
  { id: 'school_kindergarten', label: 'Школа и детский сад', icon: GraduationCap },
  { id: 'school', label: 'Школа обучения', icon: GraduationCap },
  { id: 'correction_center', label: 'Центр коррекции', icon: ShieldAlert },
  { id: 'self_development', label: 'Центр саморазвития', icon: Brain },
  { id: 'caravans', label: 'Торговые караваны', icon: Truck },
  { id: 'capture_ops', label: 'Захват', icon: Target },
  { id: 'security_service', label: 'Служба безопасности', icon: ShieldCheck },
  { id: 'bdsm_room', label: 'БДСМ-комната', icon: Zap },
  { id: 'hospital', label: 'Больница', icon: HeartPulse },
  { id: 'rest_zone', label: 'Зона отдыха', icon: BedDouble },
  { id: 'salon', label: 'Салон красоты', icon: Scissors },
  { id: 'facilities_staff', label: 'Отдел кадров', icon: Building2 },
  { id: 'staff', label: 'Персонал', icon: UserCog },
  { id: 'hiring', label: 'Найм сотрудников', icon: UserPlus },
  { id: 'slave_market', label: 'Рынок пленных', icon: Warehouse },
  { id: 'supply_contracts', label: 'Поставки рабов', icon: Handshake },
  { id: 'contracts', label: 'VIP-контракты', icon: FileText },
  { id: 'auction_house', label: 'Аукционный дом', icon: Gavel },
  { id: 'board', label: 'Совет директоров', icon: Landmark },
  { id: 'finances', label: 'Финансы и займы', icon: Bitcoin },
  { id: 'regions', label: 'Глобальные регионы', icon: Building2 },
  { id: 'meta', label: 'Достижения', icon: Trophy },
  { id: 'warehouse_mezzanine', label: 'Складской мезонин', icon: Warehouse },
  { id: 'mezzanine_journal', label: 'Журнал «Информатика»', icon: FileText },
  { id: 'mezzanine', label: 'Мезонин', icon: Gamepad2 },
  { id: 'boiler_house', label: 'Котельная', icon: Flame },
  { id: 'game_control', label: 'Панель управления', icon: Settings },
  { id: 'wasteland', label: 'Пустошь', icon: AlertTriangle }
];