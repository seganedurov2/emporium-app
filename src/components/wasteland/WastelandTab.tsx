/**
 * Wasteland tab — post-apocalyptic scavenging expeditions (в духе Apocalyptic World).
 *
 * Игрок отправляет группы выживших из своего roster в заражённые зоны пустоши:
 * фабрики, города-призрака, бункеры. Каждая вылазка стоит денег, длится не
 * одну неделю, несё в себе риск облучения радиацией, и может принести лут:
 * металл, топливо, медикаменты, патроны, консервы, электронику, оружие.
 *
 * Персонажи, получившие облучение, отмечаются в карточке радиации и могут
 * заболеть лучевой болезнью (уменьшение навыка и здоровья, пока не пролечатся).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  HardHat,
  ShieldAlert,
  Skull,
  Trash2
} from 'lucide-react';
import type { Character } from '../../gameEngine';

interface WastelandZone {
  id: string;
  name: string;
  description: string;
  radiation: number; // 0-100
  cost: number;
  duration: number; // weeks
  baseSuccess: number; // 0-1
  loot: WastelandLoot[];
}

interface WastelandLoot {
  id: string;
  name: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';
  weight: number;
  minQty: number;
  maxQty: number;
}

interface Expedition {
  id: string;
  zoneId: string;
  zoneName: string;
  characters: Character[];
  startedWeek: number;
  durationWeeks: number;
  cost: number;
  status: 'active' | 'completed' | 'failed' | 'casualties';
  result?: ExpeditionResult;
}

interface ExpeditionResult {
  success: boolean;
  radiationDose: number;
  loot: { itemId: string; qty: number }[];
  casualties: string[];
  wounded: string[];
  log: string[];
}

interface RadiationRecord {
  characterId: string;
  characterName: string;
  dose: number;
  acquiredWeek: number;
  sick: boolean;
}

const ZONES: WastelandZone[] = [
  {
    id: 'ghost_city',
    name: 'Город-призрак',
    description: 'Покинутый жилой район. Низкая радиация, можно найти консервы и медикаменты.',
    radiation: 30,
    cost: 2000,
    duration: 1,
    baseSuccess: 0.75,
    loot: [
      { id: 'canned_food', name: 'Консервы', rarity: 'common', weight: 0.30, minQty: 10, maxQty: 25 },
      { id: 'medicine', name: 'Медикаменты', rarity: 'uncommon', weight: 0.25, minQty: 2, maxQty: 8 },
      { id: 'scrap_metal', name: 'Лом металла', rarity: 'common', weight: 0.25, minQty: 2, maxQty: 8 },
      { id: 'ammo', name: 'Патроны', rarity: 'uncommon', weight: 0.15, minQty: 20, maxQty: 60 },
      { id: 'weapons', name: 'Оружие', rarity: 'rare', weight: 0.05, minQty: 1, maxQty: 2 }
    ]
  },
  {
    id: 'radioactive_forest',
    name: 'Радиоактивный лес',
    description: 'Старая лесозаготовка в зоне отчуждения. Средняя радиация.',
    radiation: 50,
    cost: 3000,
    duration: 2,
    baseSuccess: 0.65,
    loot: [
      { id: 'canned_food', name: 'Консервы', rarity: 'common', weight: 0.25, minQty: 8, maxQty: 20 },
      { id: 'medicine', name: 'Медикаменты', rarity: 'uncommon', weight: 0.15, minQty: 1, maxQty: 4 },
      { id: 'scrap_metal', name: 'Лом металла', rarity: 'common', weight: 0.30, minQty: 4, maxQty: 12 },
      { id: 'ammo', name: 'Патроны', rarity: 'uncommon', weight: 0.20, minQty: 15, maxQty: 40 },
      { id: 'weapons', name: 'Оружие', rarity: 'rare', weight: 0.10, minQty: 1, maxQty: 3 }
    ]
  },
  {
    id: 'chernobyl_factories',
    name: 'Заводские руины',
    description: 'Обломки химического комбината. Высокий уровень радиации, но много металла и оборудования.',
    radiation: 75,
    cost: 4000,
    duration: 2,
    baseSuccess: 0.55,
    loot: [
      { id: 'scrap_metal', name: 'Лом металла', rarity: 'common', weight: 0.35, minQty: 5, maxQty: 15 },
      { id: 'electronics', name: 'Электроника', rarity: 'uncommon', weight: 0.20, minQty: 1, maxQty: 5 },
      { id: 'fuel', name: 'Топливо', rarity: 'uncommon', weight: 0.15, minQty: 10, maxQty: 30 },
      { id: 'weapons', name: 'Оружие', rarity: 'rare', weight: 0.08, minQty: 1, maxQty: 3 }
    ]
  },
  {
    id: 'underground_bunker',
    name: 'Подземный бункер',
    description: 'Запечатанный бункер. Очень высокая радиация на входе, но внутри могут быть припасы военного времени.',
    radiation: 90,
    cost: 8000,
    duration: 3,
    baseSuccess: 0.35,
    loot: [
      { id: 'medicine', name: 'Медикаменты', rarity: 'rare', weight: 0.20, minQty: 5, maxQty: 15 },
      { id: 'electronics', name: 'Электроника', rarity: 'epic', weight: 0.15, minQty: 2, maxQty: 6 },
      { id: 'fuel', name: 'Топливо', rarity: 'rare', weight: 0.15, minQty: 30, maxQty: 80 },
      { id: 'weapons', name: 'Оружие', rarity: 'epic', weight: 0.10, minQty: 2, maxQty: 5 },
      { id: 'scrap_metal', name: 'Лом металла', rarity: 'common', weight: 0.40, minQty: 10, maxQty: 20 }
    ]
  }
];

const LOOT_ICONS: Record<string, string> = {
  scrap_metal: '🧱',
  electronics: '🔌',
  fuel: '⛽',
  weapons: '🔫',
  canned_food: '🥫',
  medicine: '💊',
  ammo: '🧨'
};

const RADIATION_THRESHOLD = 60;
const SICKNESS_CHANCE_PER_DOSE = 0.01;

export function WastelandTab({
  gameState
}: {
  gameState: { roster: Character[]; week: number; funds: number };
}) {
  const { roster, week: currentWeek, funds } = gameState;

  const [expeditions, setExpeditions] = useState<Expedition[]>([]);
  const [radiationRecords, setRadiationRecords] = useState<RadiationRecord[]>([]);
  const [lootInventory, setLootInventory] = useState<Record<string, number>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error'>('info');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);

  const availableCharacters = useMemo(
    () => roster.filter(c => !expeditions.some(e => e.status === 'active' && e.characters.some(x => x.id === c.id))),
    [roster, expeditions]
  );

  const isCharacterSelected = (id: string) => selectedCharacterIds.includes(id);

  // Resolve expeditions whose duration has elapsed
  useEffect(() => {
    setExpeditions(prev => {
      let changed = false;
      const next = prev.map<Expedition>(exp => {
        if (exp.status !== 'active') return exp;
        const elapsed = currentWeek - exp.startedWeek;
        if (elapsed < exp.durationWeeks) return exp;

        changed = true;
        const zone = ZONES.find(z => z.id === exp.zoneId);
        if (!zone) return { ...exp, status: 'failed' };

        const radiationPenalty = zone.radiation / 200;
        const successChance = Math.max(0.1, zone.baseSuccess - radiationPenalty);
        const success = Math.random() < successChance;

        const baseDose = zone.radiation * 0.6;
        const doseVariance = 0.7 + Math.random() * 0.6;
        const radiationDose = Math.round(baseDose * doseVariance);

        const casualties: string[] = [];
        const wounded: string[] = [];
        const newRecords: RadiationRecord[] = [];

        exp.characters.forEach(char => {
          const charDose = Math.round(radiationDose * (0.8 + Math.random() * 0.4));
          const existing = radiationRecords.find(r => r.characterId === char.id);
          const totalDose = (existing?.dose ?? 0) + charDose;
          const sick = totalDose >= RADIATION_THRESHOLD || Math.random() < charDose * SICKNESS_CHANCE_PER_DOSE;

          newRecords.push({
            characterId: char.id,
            characterName: char.name,
            dose: totalDose,
            acquiredWeek: currentWeek,
            sick
          });

          if (charDose > 80 || Math.random() < 0.05) casualties.push(char.id);
          else if (sick || charDose > 50) wounded.push(char.id);
        });

        const loot: { itemId: string; qty: number }[] = [];
        if (success) {
          const lootRolls = 2 + Math.floor(Math.random() * 3);
          for (let i = 0; i < lootRolls; i++) {
            const roll = Math.random();
            let cumulative = 0;
            for (const item of zone.loot) {
              cumulative += item.weight;
              if (roll <= cumulative) {
                const qty = item.minQty + Math.floor(Math.random() * (item.maxQty - item.minQty + 1));
                loot.push({ itemId: item.id, qty });
                break;
              }
            }
          }
        }

        const log: string[] = [
          success ? `Вылазка в ${zone.name} завершена успешно.` : `Вылазка в ${zone.name} не удалась.`,
          `Получена радиация: ${radiationDose} ед. на человека.`,
          casualties.length > 0 ? `Потери: ${casualties.length} человек.` : '',
          wounded.length > 0 ? `Облучено: ${wounded.length} человек.` : '',
          loot.length > 0 ? `Найдено: ${loot.map(l => `${l.qty}× ${itemName(l.itemId)}`).join(', ')}.` : 'Ничего не найдено.'
        ].filter(Boolean);

        setLootInventory(prevInv => {
          const next = { ...prevInv };
          loot.forEach(l => {
            next[l.itemId] = (next[l.itemId] ?? 0) + l.qty;
          });
          return next;
        });

        setRadiationRecords(prevRad => [...prevRad, ...newRecords]);

        if (casualties.length > 0) {
          setStatusMessage(`Погибло в пустоши: ${casualties.join(', ')}`);
          setStatusType('error');
        } else if (success) {
          setStatusMessage(`Вылазка успешна. Найдено ресурсов: ${loot.length}.`);
          setStatusType('success');
        } else {
          setStatusMessage('Вылазка провалена. Ресурсы не найдены.');
          setStatusType('error');
        }

        return {
          ...exp,
          status: success ? 'completed' : casualties.length > 0 ? 'casualties' : 'failed',
          result: { success, radiationDose, loot, casualties, wounded, log }
        };
      });

      if (changed) setExpeditions(next);
      return next;
    });
  }, [currentWeek, radiationRecords]);

  const itemName = (itemId: string) => ZONES.flatMap(z => z.loot).find(i => i.id === itemId)?.name ?? itemId;

  const canAfford = (cost: number) => funds >= cost;

  const startExpedition = useCallback(() => {
    if (!selectedZoneId || selectedCharacterIds.length === 0) {
      setStatusMessage('Выберите зону и хотя бы одного персонажа.');
      setStatusType('error');
      return;
    }
    const zone = ZONES.find(z => z.id === selectedZoneId);
    if (!zone) return;
    if (!canAfford(zone.cost)) {
      setStatusMessage('Недостаточно средств для вылазки.');
      setStatusType('error');
      return;
    }

    const chars = selectedCharacterIds
      .map(id => roster.find(c => c.id === id))
      .filter(Boolean) as Character[];

    const exp: Expedition = {
      id: `exp_${Date.now()}`,
      zoneId: selectedZoneId,
      zoneName: zone.name,
      characters: chars,
      startedWeek: currentWeek,
      durationWeeks: zone.duration,
      cost: zone.cost,
      status: 'active'
    };

    setExpeditions(prev => [...prev, exp]);
    setSelectedCharacterIds([]);
    setSelectedZoneId(null);
    setStatusMessage(`Вылазка в ${zone.name} начата. Вернётся через ${zone.duration} неделю(и).`);
    setStatusType('info');
  }, [selectedZoneId, selectedCharacterIds, roster, currentWeek, funds, canAfford]);

  const toggleCharacter = (id: string) => {
    setSelectedCharacterIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const sickCharacters = radiationRecords.filter(r => r.sick);
  const deadCount = expeditions
    .filter(e => e.status === 'casualties')
    .reduce((sum, e) => sum + (e.result?.casualties.length ?? 0), 0);

  const zoneStats = useMemo(
    () =>
      ZONES.map(zone => {
        const active = expeditions.find(e => e.zoneId === zone.id && e.status === 'active');
        return { ...zone, activeExpedition: active };
      }),
    [expeditions]
  );

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl text-left">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-6 h-6 text-amber-500" />
          <h2 className="text-lg font-bold text-white">Пустошь — вылазки в заражённые зоны</h2>
        </div>
        <p className="text-slate-400 text-sm mb-4">
          Отправляйте группы выживших в заражённые зоны пустоши. Вылазка стоит средств,
          длится несколько недель, несёт риск облучения радиацией, но может принести
          ценный лут.
        </p>
        <div className="grid grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Skull className="w-4 h-4 text-red-500" />
            <span>{deadCount} погибло в пустоши</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span>{sickCharacters.length} облучено</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>Неделя {currentWeek}</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300 justify-end">
            <span className="font-mono text-amber-400">{funds} AX</span>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            statusType === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
              : statusType === 'error'
              ? 'border-red-500/30 bg-red-500/5 text-red-300'
              : 'border-slate-700/30 bg-slate-800/50 text-slate-300'
          }`}
        >
          {statusMessage}
        </div>
      )}

      {sickCharacters.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-2">
            <Skull className="w-4 h-4 text-red-500" />
            <h3 className="font-bold text-red-400 text-sm">Лучевая болезнь</h3>
          </div>
          <p className="text-xs text-red-200 mb-3">
            Следующие персонажи получили критическую дозу радиации и нуждаются в лечении:
          </p>
          <div className="space-y-1">
            {sickCharacters.map(rec => (
              <div
                key={rec.characterId}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="text-red-200 truncate">{rec.characterName}</span>
                <span className="font-mono text-red-300">доза {rec.dose} ед.</span>
                <button
                  onClick={() => {
                    setRadiationRecords(prev => prev.filter(r => r.characterId !== rec.characterId));
                    setStatusMessage(`${rec.characterName} пролечен от радиации.`);
                    setStatusType('success');
                  }}
                  className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-2 py-1 rounded border border-red-500/30 transition"
                >
                  Вылечить
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {zoneStats.map(zone => {
          const activeExp = zone.activeExpedition;
          const weeksLeft = activeExp ? zone.duration - (currentWeek - activeExp.startedWeek) : 0;

          return (
            <div
              key={zone.id}
              className={`rounded-xl border p-4 shadow-lg transition hover:border-slate-600 ${
                zone.radiation > 70
                  ? 'border-red-500/30 bg-red-500/5'
                  : zone.radiation > 40
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-slate-700/30 bg-slate-900/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <HardHat
                    className={`w-5 h-5 ${
                      zone.radiation > 70 ? 'text-red-500' : zone.radiation > 40 ? 'text-amber-500' : 'text-emerald-500'
                    }`}
                  />
                  <h4 className="font-bold text-white text-sm truncate">{zone.name}</h4>
                </div>
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                    zone.radiation > 70
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : zone.radiation > 40
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  Радиация {zone.radiation}
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-3 line-clamp-2">{zone.description}</p>
              <div className="space-y-2 text-xs mb-3">
                <div className="flex justify-between">
                  <span className="text-slate-400">Стоимость:</span>
                  <span className={canAfford(zone.cost) ? 'text-slate-300' : 'text-red-400'}>
                    {zone.cost} AX
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Длительность:</span>
                  <span className="text-slate-300">{zone.duration} нед.</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Шанс успеха:</span>
                  <span className="text-slate-300">{Math.round(zone.baseSuccess * 100)}%</span>
                </div>
              </div>

              {activeExp ? (
                <div className="rounded bg-slate-800/50 border border-slate-700 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span className="text-xs text-slate-300">Вылазка активна</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-1.5 mb-1">
                    <div
                      className="bg-amber-500 h-1.5 rounded-full"
                      style={{ width: Math.max(0, ((zone.duration - weeksLeft) / zone.duration) * 100) }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Осталось недель:</span>
                    <span className="font-mono text-amber-400">{Math.max(0, weeksLeft)}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-400">
                    Участники: {activeExp.characters.map(c => c.name).join(', ')}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-1.5 mb-1 text-xs text-slate-400">
                    <span className="text-amber-400">Выбрать команду:</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {availableCharacters.map(char => {
                      const selected = isCharacterSelected(char.id);
                      return (
                        <button
                          key={char.id}
                          onClick={() => toggleCharacter(char.id)}
                          className={`rounded border px-2 py-1 text-xs transition ${
                            selected
                              ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                              : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-500 hover:bg-slate-700'
                          }`}
                        >
                          <span className={selected ? 'text-amber-400' : 'text-slate-400'}>
                            {char.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={startExpedition}
                    disabled={
                      !selectedZoneId || selectedCharacterIds.length === 0 || !canAfford(zone.cost)
                    }
                    className={`w-full mt-2 rounded py-2 text-xs font-medium transition ${
                      selectedZoneId && selectedCharacterIds.length > 0 && canAfford(zone.cost)
                        ? 'bg-amber-600 hover:bg-amber-500 text-white border border-amber-500/30'
                        : 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {selectedZoneId && selectedCharacterIds.length > 0 && canAfford(zone.cost)
                      ? 'Отправить вылазку'
                      : 'Выберите зону и команду'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {expeditions.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-slate-400" />
            <h4 className="font-bold text-white text-sm">История вылазок</h4>
          </div>
          <div className="space-y-2 max-h-[44vh] overflow-y-auto pr-2">
            {[...expeditions].reverse().map(exp => {
              const res = exp.result;
              const statusColor =
                exp.status === 'completed'
                  ? 'text-emerald-400'
                  : exp.status === 'failed'
                  ? 'text-red-400'
                  : exp.status === 'casualties'
                  ? 'text-red-500'
                  : 'text-amber-400';
              return (
                <div
                  key={exp.id}
                  className="rounded border border-slate-800 bg-slate-950/80 p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-sm">{exp.zoneName}</span>
                    <span className={`text-xs font-bold ${statusColor}`}>
                      {exp.status === 'completed' ? 'Успех' : exp.status === 'failed' ? 'Провал' : exp.status === 'casualties' ? 'Потери' : 'В пути'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mb-1">
                    Команда: {exp.characters.map(c => c.name).join(', ')}
                  </div>
                  <div className="text-xs text-slate-400 mb-2">
                    Начата: неделя {exp.startedWeek} • вернётся: неделя{' '}
                    {exp.startedWeek + exp.durationWeeks} • потрачено {exp.cost} AX
                  </div>
                  {res && (
                    <div className="space-y-1">
                      {res.log.map((line, i) => (
                        <div key={i} className="text-xs text-slate-300">
                          • {line}
                        </div>
                      ))}
                      {res.loot.length > 0 && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-emerald-300">
                          <span>Лут:</span>{' '}
                          {res.loot.map(l => `${l.qty}× ${LOOT_ICONS[l.itemId] ?? l.itemId}`).join(' ')}
                        </div>
                      )}
                      {res.casualties.length > 0 && (
                        <div className="mt-1 text-xs text-red-400">
                          Погибло: {res.casualties.join(', ')}
                        </div>
                      )}
                      {res.wounded.length > 0 && (
                        <div className="mt-1 text-xs text-amber-400">
                          Облучено: {res.wounded.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {Object.keys(lootInventory).length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <Trash2 className="w-4 h-4 text-slate-400" />
            <h4 className="font-bold text-white text-sm">Найденные ресурсы</h4>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries(lootInventory).map(([itemId, qty]) => (
              <div
                key={itemId}
                className="rounded bg-slate-800/50 border border-slate-700 px-3 py-2 text-xs text-center"
              >
                <div className="text-slate-400" style={{ fontSize: 20 }}>
                  {LOOT_ICONS[itemId] ?? '📦'}
                </div>
                <div className="text-slate-300 font-medium">{qty}</div>
                <div className="text-[10px] text-slate-500 truncate" title={itemId}>
                  {itemId}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
