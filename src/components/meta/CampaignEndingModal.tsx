import { Crown, Play, Skull, X } from 'lucide-react';

export interface CampaignEnding {
  type: 'victory' | 'defeat';
  week: number;
}

interface CampaignEndingModalProps {
  ending: CampaignEnding;
  campaignName: string;
  prestigeLevel: number;
  onContinue: () => void;
  onPrestige: () => void;
  onRetire: () => void;
}

/**
 * The campaign ending screen. Victory offers New Game+ (prestige);
 * defeat offers continuing under receivership or retiring the run.
 */
export function CampaignEndingModal({ ending, campaignName, prestigeLevel, onContinue, onPrestige, onRetire }: CampaignEndingModalProps) {
  const victory = ending.type === 'victory';

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className={`rounded-2xl max-w-lg w-full p-6 shadow-2xl text-left border ${victory ? 'bg-emerald-950/90 border-emerald-500/40' : 'bg-red-950/90 border-red-500/40'}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-xl font-bold flex items-center gap-2 ${victory ? 'text-emerald-300' : 'text-red-300'}`}>
            {victory ? <Crown className="w-6 h-6" /> : <Skull className="w-6 h-6" />}
            {victory ? 'Победа кампании!' : 'Кампания проиграна'}
          </h3>
          <button onClick={onContinue} className="text-slate-400 hover:text-white cursor-pointer" aria-label="Закрыть">
            <X className="w-5 h-5" />
          </button>
        </div>

        {victory ? (
          <div className="space-y-3 text-sm text-emerald-100">
            <p>
              Синдикат «{campaignName}» достиг {ending.week}-й недели,
              сколотил состояние и выстоял в репутации. Имя компании
              вписано в историю — цель кампании выполнена.
            </p>
            <p className="text-xs text-emerald-300/80 font-mono">
              Престиж {prestigeLevel} → {prestigeLevel + 1}: стартовый капитал +50%, доходы +25% навсегда.
            </p>
          </div>
        ) : (
          <div className="space-y-3 text-sm text-red-100">
            <p>
              Казна синдиката «{campaignName}» опустела на {ending.week}-й неделе.
              Кредиторы объявили банкротство, компания перешла под внешнее управление.
            </p>
            <p className="text-xs text-red-300/80">
              Вы можете продолжить игру под внешним управлением или завершить кампанию и начать новую.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2 mt-6">
          {victory && (
            <button
              onClick={onPrestige}
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2.5 rounded-lg font-bold text-sm transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Crown className="w-4 h-4" /> New Game+ — начать с престижем {prestigeLevel + 1}
            </button>
          )}
          <button
            onClick={onContinue}
            className={`w-full px-4 py-2.5 rounded-lg font-bold text-sm transition cursor-pointer flex items-center justify-center gap-2 ${victory
              ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
              : 'bg-red-700 hover:bg-red-600 text-white'}`}
          >
            <Play className="w-4 h-4" />
            {victory ? 'Продолжить играть' : 'Продолжить под внешним управлением'}
          </button>
          {!victory && (
            <button
              onClick={onRetire}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-lg font-semibold text-sm transition cursor-pointer"
            >
              Завершить кампанию
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
