import { useState } from 'react';
import { Brain, Sparkles, Trash2, Repeat } from 'lucide-react';
import type { Character } from '../../gameEngine';
import {
  TRAIT_DEFINITIONS,
  TRAIT_BY_ID,
  TRAIT_OPERATION_COSTS,
  type TraitId,
  type TraitOperation,
  describeTraits
} from '../../selfDevelopmentEngine';

interface SelfDevelopmentTabProps {
  roster: Character[];
  funds: number;
  onApply: (characterId: string, plan: { operation: TraitOperation; traitId: TraitId; replacementId?: TraitId }) => void;
}

const CARD = 'bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl';
const CONTROL =
  'bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-purple-500 focus:outline-none';

const OPERATION_LABELS: Record<TraitOperation, string> = {
  strengthen: 'Закрепить',
  remove: 'Снять',
  replace: 'Заменить'
};

export function SelfDevelopmentTab({ roster, funds, onApply }: SelfDevelopmentTabProps) {
  const [characterId, setCharacterId] = useState<string>(roster[0]?.id ?? '');
  const [operation, setOperation] = useState<TraitOperation>('strengthen');
  const [traitId, setTraitId] = useState<TraitId>('docile');
  const [replacementId, setReplacementId] = useState<TraitId>('loyal');

  const character = roster.find(entry => entry.id === characterId) ?? roster[0] ?? null;
  const cost = TRAIT_OPERATION_COSTS[operation];
  const affordable = funds >= cost;

  return (
    <div className="space-y-6 text-left">
      <div className="flex items-center gap-3">
        <Brain className="w-7 h-7 text-purple-400" />
        <div>
          <h2 className="text-xl font-bold text-white">Центр саморазвития</h2>
          <p className="text-sm text-slate-400">
            Управление психологическими чертами: закрепление, снятие и замена. CEO может развивать черты, связанные с происхождением.
          </p>
        </div>
      </div>

      <div className={CARD}>
        <h3 className="font-bold text-white mb-3">Доступные черты</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {TRAIT_DEFINITIONS.map(definition => (
            <div key={definition.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h4 className="font-semibold text-white text-sm">{definition.name}</h4>
              </div>
              <p className="mt-1 text-xs text-slate-400">{definition.description}</p>
              {definition.conflictsWith && definition.conflictsWith.length > 0 && (
                <p className="mt-1 text-[11px] text-rose-400">
                  Конфликт: {definition.conflictsWith.map(id => TRAIT_BY_ID[id]?.name ?? id).join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className={CARD}>
        <h3 className="font-bold text-white mb-3">Операция над чертой</h3>
        {roster.length === 0 ? (
          <p className="text-sm text-slate-400">Ростер пуст.</p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <label className="block text-sm text-slate-300">
                Персонаж
                <select className={`${CONTROL} mt-1 w-full`} value={characterId} onChange={event => setCharacterId(event.target.value)}>
                  {roster.map(entry => (
                    <option key={entry.id} value={entry.id}>{entry.name}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-slate-300">
                Операция
                <select className={`${CONTROL} mt-1 w-full`} value={operation} onChange={event => setOperation(event.target.value as TraitOperation)}>
                  {(Object.keys(OPERATION_LABELS) as TraitOperation[]).map(key => (
                    <option key={key} value={key}>{OPERATION_LABELS[key]}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-slate-300">
                Черта
                <select className={`${CONTROL} mt-1 w-full`} value={traitId} onChange={event => setTraitId(event.target.value as TraitId)}>
                  {TRAIT_DEFINITIONS.map(definition => (
                    <option key={definition.id} value={definition.id}>{definition.name}</option>
                  ))}
                </select>
              </label>
              {operation === 'replace' && (
                <label className="block text-sm text-slate-300">
                  На черту
                  <select className={`${CONTROL} mt-1 w-full`} value={replacementId} onChange={event => setReplacementId(event.target.value as TraitId)}>
                    {TRAIT_DEFINITIONS.map(definition => (
                      <option key={definition.id} value={definition.id}>{definition.name}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {character && (
              <p className="mt-4 text-sm text-slate-300">
                Текущие черты <span className="text-white font-medium">{character.name}</span>:{' '}
                <span className="text-purple-300">{describeTraits(character)}</span>
              </p>
            )}

            <div className="mt-4 flex items-center gap-4">
              <button
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                disabled={!affordable || !character}
                onClick={() => onApply(characterId, { operation, traitId, ...(operation === 'replace' ? { replacementId } : {}) })}
              >
                {operation === 'remove' ? <Trash2 className="w-4 h-4" /> : operation === 'replace' ? <Repeat className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                Применить · {cost} AX
              </button>
              <span className={`text-xs font-mono ${affordable ? 'text-slate-400' : 'text-rose-400'}`}>
                В казне {funds} AX
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
