/**
 * PhoneWidget — CSS-рисунок смартфона в правом нижнем углу.
 * Никаких внешних картинок: полностью на CSS (разметка + тени + блик экрана).
 */

interface PhoneWidgetProps {
  className?: string;
}

export function PhoneWidget({ className }: PhoneWidgetProps) {
  return (
    <div
      className={[
        'fixed right-4 bottom-4 z-[80] pointer-events-none select-none',
        className
      ].filter(Boolean).join(' ')}
      aria-label="Смартфон"
    >
      {/* Тень под телефоном */}
      <div className="absolute inset-0 -z-10 blur-xl opacity-40 bg-slate-900 rounded-2xl" />

      {/* Корпус телефона */}
      <div className="relative w-20 h-36 rounded-2xl bg-slate-950 border border-slate-700 shadow-2xl overflow-hidden rotate-3 scale-100 transition-transform duration-300 hover:scale-105">
        {/* Верхняя панель (динамик + датчики) */}
        <div className="flex items-center justify-center gap-1 px-2 py-1 bg-slate-900/80 border-b border-slate-700/50">
          <div className="w-4 h-0.5 bg-slate-400 rounded-full opacity-60" />
          <div className="w-1 h-1 rounded-full bg-slate-500 opacity-40" />
          <div className="w-1 h-1 rounded-full bg-slate-500 opacity-40" />
        </div>

        {/* Экран */}
        <div className="relative flex-1 bg-black/90 border border-slate-800/50 p-2 flex flex-col">
          {/* Блик экрана */}
          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/10 to-transparent pointer-events-none rounded-[14px]" />
          {/* Содержимое экрана — стилизованное приложение Эмпориум */}
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-[10px] font-bold tracking-widest text-slate-500 uppercase">ЭМПОРИУМ</div>
          </div>
          {/* Домашняя индикаторная полоска внизу экрана */}
          <div className="mt-2 flex justify-center">
            <div className="w-8 h-0.5 rounded-full bg-slate-700 opacity-50" />
          </div>
        </div>

        {/* Боковые кнопки */}
        <div className="absolute left-0 top-1/4 h-4 w-1 bg-slate-700/60" />
        <div className="absolute right-0 top-1/2 h-6 w-1 bg-slate-700/60" />
      </div>

      {/* Подпись под телефоном */}
      <div className="mt-1 text-[10px] text-slate-500 font-medium whitespace-nowrap">Telegram Mini App</div>
    </div>
  );
}
