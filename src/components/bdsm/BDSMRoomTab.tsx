import React, { useState } from 'react';
import { ArrowUpDown, Zap, Heart, Skull, ShieldAlert, TrendingDown, Lock, Crown, AlertCircle } from 'lucide-react';
import { getTerm, type Platform } from '../../terminology';
import type { ManagedCampaignState } from '../../saveState';
import type { RequestVenueId } from '../../administratorEngine';
import { BDSM_WORKPLACE_ROLES, VENUE_ADMINISTRATORS } from '../../administratorEngine';
import { VenueAdministratorPanel } from '../venue/VenueAdministratorPanel';
import {
  ROSTER_SORT_OPTIONS,
  rosterSortById,
  rosterSortValue,
  sortRoster,
  type RosterSortId
} from '../../rosterSort';

const CONTROL_CLASS = 'min-h-8 rounded-md border border-slate-700 bg-slate-950 px-2.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 focus:border-slate-500 focus:outline-2 focus:outline-offset-1 focus:outline-amber-400';

interface BDSMRoomTabProps {
  state: ManagedCampaignState;
  platform: Platform;
  onAcceptRequest: (venue: RequestVenueId) => void;
}

type DisciplineMode = 'soft' | 'moderate' | 'hard';
type EquipmentType = 'restraints' | 'stimulators' | 'accessories';

interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  bonus: string;
  riskMod: number;
}

const AVAILABLE_EQUIPMENT: Equipment[] = [
  { id: 'shackles', name: 'Тяжелые кандалы', type: 'restraints', bonus: 'Шанс побега -15%', riskMod: 5 },
  { id: 'cage', name: 'Стальная клетка', type: 'restraints', bonus: 'Шанс побега -30%', riskMod: 10 },
  { id: 'whip', name: 'Кожаный кнут', type: 'stimulators', bonus: 'Покорность +5% за сессию', riskMod: 20 },
  { id: 'collar', name: 'Ошейник с шипами', type: 'accessories', bonus: 'Стоимость +10%', riskMod: 2 },
];

export const BDSMRoomTab: React.FC<BDSMRoomTabProps> = ({ state, platform, onAcceptRequest }) => {
  const [selectedSlaveId, setSelectedSlaveId] = useState<string | null>(null);
  const [mode, setMode] = useState<DisciplineMode>('moderate');
  const [selectedEquipId, setSelectedEquipId] = useState<string | null>(null);
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string | null>(null);
  const [slaveSortId, setSlaveSortId] = useState<RosterSortId>('none');
  const [slaveSortFlipped, setSlaveSortFlipped] = useState<Partial<Record<RosterSortId, boolean>>>({});
  const [specialistSortId, setSpecialistSortId] = useState<RosterSortId>('none');
  const [specialistSortFlipped, setSpecialistSortFlipped] = useState<Partial<Record<RosterSortId, boolean>>>({});

  const slaves = state.roster.filter(c => c.isSlave);
  const specialists = state.roster.filter(c => c.role === 'master' || c.role === 'dominatrix');
  const slaveDescending = slaveSortFlipped[slaveSortId] ?? rosterSortById(slaveSortId).descending;
  const specialistDescending = specialistSortFlipped[specialistSortId] ?? rosterSortById(specialistSortId).descending;
  const sortedSlaves = sortRoster(slaves, slaveSortId, slaveDescending, rosterSortValue);
  const sortedSpecialists = sortRoster(specialists, specialistSortId, specialistDescending, rosterSortValue);
  const selectedSlave = slaves.find(s => s.id === selectedSlaveId);
  const selectedSpecialist = specialists.find(s => s.id === selectedSpecialistId);

  const admin = VENUE_ADMINISTRATORS.bdsm_room;

  const getModeDetails = (m: DisciplineMode) => {
    switch (m) {
      case 'soft': return { label: 'Мягкое воздействие', effect: 'Медленный рост покорности, низкий риск', risk: '2%' };
      case 'moderate': return { label: 'Дисциплинарный режим', effect: 'Сбалансированный рост, умеренный риск', risk: '10%' };
      case 'hard': return { label: 'Жесткое подавление', effect: 'Быстрый рост покорности, высокий риск травм', risk: '25%' };
    }
  };

  const calculateTotalRisk = () => {
    let baseRisk = parseInt(getModeDetails(mode).risk);
    if (selectedEquipId) {
      const eq = AVAILABLE_EQUIPMENT.find(e => e.id === selectedEquipId);
      if (eq) baseRisk += eq.riskMod;
    }
    if (selectedSpecialist) baseRisk -= 10; 
    return Math.max(0, baseRisk);
  };

  return (
    <div className="p-6 space-y-6 text-left">
      <div className="flex items-center justify-between">
         <h2 className="text-2xl font-bold text-white flex items-center gap-2">
           <Zap className="w-6 h-6 text-purple-400" />
           {getTerm('bdsm_room', platform)}: Исправительный Центр
         </h2>
        <div className="flex gap-2">
          <div className="px-3 py-1 bg-red-900/30 rounded-full text-xs font-semibold text-red-300 border border-red-500/30 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Режим наказаний: Активен
          </div>
        </div>
      </div>

      <VenueAdministratorPanel
        venue="bdsm_room"
        request={state.venueRequests?.bdsm_room ?? null}
        funds={state.funds}
        onAccept={onAcceptRequest}
      />

      <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
        <h3 className="text-xs font-semibold text-white mb-1">
          {admin.name} — {admin.role}
        </h3>
        <p className="text-[10px] text-slate-500">
          Рабочее место: {admin.workplace}. Роли на посту: {BDSM_WORKPLACE_ROLES.join(' / ')}.
          Уборщик держит порядок в комнате, уборщица (госпожа) ведёт воспитание пленниц.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Column 1: Slaves */}
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
           <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex flex-col gap-2">
             <h3 className="font-bold text-white flex items-center gap-2">
               <Heart className="w-4 h-4 text-pink-400" />
               {getTerm('objects', platform)}
             </h3>
             <label className="sr-only" htmlFor="bdsm-slave-sort">Сортировка объектов</label>
             <select id="bdsm-slave-sort" value={slaveSortId} onChange={event => setSlaveSortId(event.target.value as RosterSortId)} className={CONTROL_CLASS}>
               {ROSTER_SORT_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
             </select>
             <button
               type="button"
               onClick={() => setSlaveSortFlipped(previous => ({ ...previous, [slaveSortId]: !slaveDescending }))}
               disabled={slaveSortId === 'none'}
               aria-label="Сменить направление сортировки"
               className={`${CONTROL_CLASS} inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40`}
             >
               <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-purple-400" />
               {slaveDescending ? 'По убыванию' : 'По возрастанию'}
             </button>
           </div>
          <div className="overflow-y-auto max-h-[600px]">
            {sortedSlaves.length > 0 ? (
              sortedSlaves.map(slave => (
                <button
                  key={slave.id}
                  onClick={() => setSelectedSlaveId(slave.id)}
                  className={`w-full p-3 text-left border-b border-slate-800 transition-colors flex justify-between items-center ${selectedSlaveId === slave.id ? 'bg-purple-500/20 text-purple-200' : 'hover:bg-slate-800 text-slate-400'}`}
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-white">{slave.name}</span>
                    <span className="text-[10px] opacity-70">Покорность: {slave.submission || 0}%</span>
                  </div>
                  {slave.submission && slave.submission < 30 && (
                    <div className="flex flex-col items-end">
                      <TrendingDown className="w-4 h-4 text-red-400" />
                      <span className="text-[8px] text-red-400 font-bold">ВЫСОКИЙ РИСК</span>
                    </div>
                  )}
                </button>
              ))
             ) : (
               <div className="p-8 text-center text-slate-500 italic text-sm">Нет доступных {getTerm('prisoners', platform)}</div>
             )}
           </div>
        </div>

        {/* Column 2: Specialist & Equipment */}
        <div className="space-y-6">
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-lg space-y-4">
            <h3 className="font-bold text-white flex items-center gap-2 text-sm border-b border-slate-800 pb-2">
              <Crown className="w-4 h-4 text-amber-400" />
              Мастер / Госпожа
            </h3>
            <div className="flex flex-col gap-2">
              <label className="sr-only" htmlFor="bdsm-specialist-sort">Сортировка мастеров</label>
              <select id="bdsm-specialist-sort" value={specialistSortId} onChange={event => setSpecialistSortId(event.target.value as RosterSortId)} className={CONTROL_CLASS}>
                {ROSTER_SORT_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setSpecialistSortFlipped(previous => ({ ...previous, [specialistSortId]: !specialistDescending }))}
                disabled={specialistSortId === 'none'}
                aria-label="Сменить направление сортировки"
                className={`${CONTROL_CLASS} inline-flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-40`}
              >
                <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5 text-amber-400" />
                {specialistDescending ? 'По убыванию' : 'По возрастанию'}
              </button>
            </div>
            <div className="space-y-2">
              {specialists.length > 0 ? (
                sortedSpecialists.map(spec => (
                  <button
                    key={spec.id}
                    onClick={() => setSelectedSpecialistId(spec.id)}
                    className={`w-full p-2 rounded-lg text-xs text-left transition-colors ${selectedSpecialistId === spec.id ? 'bg-amber-500/20 text-amber-200 border border-amber-500/50' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                  >
                    {spec.name} ({spec.role === 'master' ? 'Мастер' : 'Госпожа'})
                  </button>
                ))
              ) : (
                <div className="text-xs text-slate-500 italic">Нет сертифицированных мастеров</div>
              )}
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 shadow-lg space-y-4">
            <h3 className="font-bold text-white flex items-center gap-2 text-sm border-b border-slate-800 pb-2">
              <Lock className="w-4 h-4 text-blue-400" />
              Оборудование
            </h3>
            <div className="space-y-2">
              {AVAILABLE_EQUIPMENT.map(eq => (
                <button
                  key={eq.id}
                  onClick={() => setSelectedEquipId(eq.id)}
                  className={`w-full p-2 rounded-lg text-xs text-left transition-colors ${selectedEquipId === eq.id ? 'bg-blue-500/20 text-blue-200 border border-blue-500/50' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  <div className="font-bold">{eq.name}</div>
                  <div className="text-[10px] opacity-70">{eq.bonus}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Column 3 & 4: Session Controls */}
        <div className="lg:col-span-2 space-y-6">
          {selectedSlave ? (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedSlave.name}</h3>
                  <p className="text-sm text-slate-400">Текущая покорность: {selectedSlave.submission || 0}%</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 uppercase font-bold">Статус</div>
                  <div className="text-sm font-semibold text-red-400">Под наказанием</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['soft', 'moderate', 'hard'] as DisciplineMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${mode === m ? 'border-purple-500 bg-purple-500/10' : 'border-slate-800 bg-slate-800/30 hover:border-slate-700'}`}
                  >
                    <div className="font-bold text-white mb-1">{getModeDetails(m).label}</div>
                    <div className="text-xs text-slate-400 mb-2">{getModeDetails(m).effect}</div>
                    <div className="text-xs font-bold text-red-400">Базовый риск: {getModeDetails(m).risk}</div>
                  </button>
                ))}
              </div>

              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  <div>
                    <div className="text-sm font-bold text-white">Итоговый риск травм и срывов</div>
                    <div className="text-xs text-slate-400">Учитывает режим, оборудование и опыт мастера</div>
                  </div>
                </div>
                <div className="text-2xl font-black text-red-500">{calculateTotalRisk()}%</div>
              </div>

              <div className="pt-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-slate-400 text-sm italic">
                  <AlertCircle className="w-4 h-4" />
                  <span>Сессия снимет риск побега на 1 неделю</span>
                </div>
                <button className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition shadow-lg shadow-purple-500/20 cursor-pointer flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Начать сессию
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-slate-800 rounded-xl">
               <div className="bg-slate-800 p-4 rounded-full mb-4">
                 <Skull className="w-8 h-8 text-slate-600" />
               </div>
               <h3 className="text-lg font-medium text-slate-400">Выберите {getTerm('prisoner', platform).toLowerCase()} для применения мер дисциплины</h3>
             </div>
          )}
        </div>
      </div>
      {/* Video archive — BDSM room footage */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-4 h-4 text-purple-400" />
          <h3 className="font-bold text-white">Видеоархив — тег «BDSM комната»</h3>
        </div>
        <div className="rounded-lg border border-slate-700 bg-black overflow-hidden aspect-video relative group">
          <video
            className="w-full h-full object-cover"
            controls
            poster="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/1280px-Big_buck_bunny_poster_big.jpg"
          >
            <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4" />
            Ваш браузер не поддерживает воспроизведение видео.
          </video>
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/0 transition">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 text-white text-xs font-medium backdrop-blur-sm border border-white/20">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              BDSM комната • Эксплуатация
            </div>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 mt-2">
          Запись сессии из исправительного центра. Доступно для просмотра после завершения сессии дисциплины.
        </p>
      </div>
    </div>
  );
};
