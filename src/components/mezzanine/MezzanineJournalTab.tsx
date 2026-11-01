import { useState, useMemo } from 'react';
import { FileText, Search, BookOpen, Calendar, Users, File, Award } from 'lucide-react';

type JournalSectionId =
  | 'automation_design'
  | 'signal_processing'
  | 'mathematical_modeling'
  | 'information_security'
  | 'pattern_recognition'
  | 'systems_devices'
  | 'parallel_computing'
  | 'space_geo_it'
  | 'intelligent_systems'
  | 'applied_it'
  | 'practical_developments'
  | 'programs'
  | 'announcements'
  | 'conference_reports'
  | 'book_reviews';

interface JournalSection {
  id: JournalSectionId;
  label: string;
  icon: typeof FileText;
  color: string;
}

const JOURNAL_SECTIONS: JournalSection[] = [
  { id: 'automation_design', label: 'Автоматизация проектирования', icon: FileText, color: 'text-blue-400' },
  { id: 'signal_processing', label: 'Обработка сигналов, изображений и речи', icon: FileText, color: 'text-emerald-400' },
  { id: 'mathematical_modeling', label: 'Математическое моделирование', icon: FileText, color: 'text-amber-400' },
  { id: 'information_security', label: 'Информационная безопасность', icon: FileText, color: 'text-red-400' },
  { id: 'pattern_recognition', label: 'Распознавание образов', icon: FileText, color: 'text-purple-400' },
  { id: 'systems_devices', label: 'Системы, приборы и устройства', icon: FileText, color: 'text-cyan-400' },
  { id: 'parallel_computing', label: 'Параллельные вычисления', icon: FileText, color: 'text-indigo-400' },
  { id: 'space_geo_it', label: 'Космические ИТ и геоинформатика', icon: FileText, color: 'text-rose-400' },
  { id: 'intelligent_systems', label: 'Интеллектуальные системы', icon: FileText, color: 'text-fuchsia-400' },
  { id: 'applied_it', label: 'Прикладные информационные технологии', icon: FileText, color: 'text-orange-400' },
  { id: 'practical_developments', label: 'Практические разработки', icon: Award, color: 'text-lime-400' },
  { id: 'programs', label: 'Российско-белорусские и национальные программы', icon: Users, color: 'text-violet-400' },
  { id: 'announcements', label: 'Объявления', icon: Calendar, color: 'text-slate-400' },
  { id: 'conference_reports', label: 'Отчеты о конференциях', icon: BookOpen, color: 'text-stone-400' },
  { id: 'book_reviews', label: 'Рецензии на книги', icon: File, color: 'text-zinc-400' }
];

interface JournalArticle {
  id: string;
  section: JournalSectionId;
  title: string;
  authors: string;
  year: number;
  issue: string;
  pages: string;
  abstract: string;
}

const JOURNAL_ARTICLES: JournalArticle[] = [
  {
    id: 'art_001',
    section: 'automation_design',
    title: 'Автоматизированные системы проектирования складских мезонинов',
    authors: 'Иванов А.П., Петров С.В.',
    year: 2024,
    issue: '№ 3 (47)',
    pages: '45–58',
    abstract: 'Рассматриваются подходы к автоматизации проектирования многоуровневых стеллажных конструкций с интеграцией WMS/WCS.'
  },
  {
    id: 'art_002',
    section: 'information_security',
    title: 'Защита данных в распределённых системах управления складом',
    authors: 'Сидорова Е.Н.',
    year: 2024,
    issue: '№ 4 (48)',
    pages: '112–126',
    abstract: 'Анализ угроз и методов защиты информации в автоматизированных складских комплексах.'
  },
  {
    id: 'art_003',
    section: 'intelligent_systems',
    title: 'Интеллектуальное управление логистикой на мезонинных площадках',
    authors: 'Козлов Д.Р., Орлов М.Ю.',
    year: 2025,
    issue: '№ 1 (49)',
    pages: '15–29',
    abstract: 'Применение интеллектуальных систем для оптимизации маршрутов перемещения грузов между уровнями.'
  },
  {
    id: 'art_004',
    section: 'parallel_computing',
    title: 'Параллельные вычисления при моделировании потоков на мезонине',
    authors: 'Новикова Т.К.',
    year: 2025,
    issue: '№ 2 (50)',
    pages: '67–81',
    abstract: 'Моделирование параллельной обработки запросов на приём и выдачу грузов.'
  },
  {
    id: 'art_005',
    section: 'space_geo_it',
    title: 'Геоинформатические системы в планировании складских территорий',
    authors: 'Морозов А.Л.',
    year: 2025,
    issue: '№ 2 (50)',
    pages: '89–104',
    abstract: 'Использование ГИС для оптимального размещения мезонинных объектов.'
  }
];

interface MezzanineJournalTabProps {
  onOpenTab?: (tabId: string) => void;
}

export function MezzanineJournalTab({ onOpenTab }: MezzanineJournalTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState<JournalSectionId | 'all'>('all');
  const [activeArticle, setActiveArticle] = useState<string | null>(null);

  const filteredArticles = useMemo(() => {
    return JOURNAL_ARTICLES.filter(article => {
      const matchesSection = selectedSection === 'all' || article.section === selectedSection;
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        article.title.toLowerCase().includes(q) ||
        article.authors.toLowerCase().includes(q) ||
        article.abstract.toLowerCase().includes(q);
      return matchesSection && matchesSearch;
    });
  }, [searchQuery, selectedSection]);

  const sectionById = useMemo(() => {
    const map = new Map<JournalSectionId, JournalSection>();
    for (const s of JOURNAL_SECTIONS) map.set(s.id, s);
    return map;
  }, []);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-start gap-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" /> Журнал «Информатика»
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-400">
              Оригинальные статьи по информатике, автоматизации проектирования, обработке сигналов,
              математическому моделированию, информационной безопасности, распознаванию образов,
              интеллектуальным системам и другим разделам.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span>{JOURNAL_ARTICLES.length} статей</span>
        </div>
      </header>

      {/* Поиск и фильтры */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Поиск по статьям..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400 transition"
            />
          </div>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value as JournalSectionId | 'all')}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
          >
            <option value="all">Все разделы</option>
            {JOURNAL_SECTIONS.map(section => (
              <option key={section.id} value={section.id}>{section.label}</option>
            ))}
          </select>
        </div>

        {/* Разделы журнала */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setSelectedSection('all')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition ${
              selectedSection === 'all'
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Все разделы
          </button>
          {JOURNAL_SECTIONS.map(section => (
            <button
              key={section.id}
              onClick={() => setSelectedSection(section.id)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition ${
                selectedSection === section.id
                  ? `bg-slate-800 ${section.color} border border-slate-700`
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {/* Список статей */}
      <div className="space-y-3">
        {filteredArticles.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
            <p className="text-slate-400 text-sm">Статьи не найдены.</p>
          </div>
        ) : (
          filteredArticles.map(article => {
            const section = sectionById.get(article.section);
            const isActive = activeArticle === article.id;
            return (
              <div
                key={article.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-amber-500/50 transition cursor-pointer group"
                onClick={() => setActiveArticle(isActive ? null : article.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold ${section?.color ?? 'text-slate-400'}`}>
                        {section?.label}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">{article.year} · {article.issue}</span>
                    </div>
                    <h3 className="font-bold text-white text-sm leading-tight group-hover:text-amber-400 transition">
                      {article.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {article.authors} · с. {article.pages}
                    </p>
                  </div>
                  <div className="text-xs text-slate-500 font-mono text-right">
                    {article.pages}
                  </div>
                </div>
                {isActive && (
                  <div className="mt-3 pt-3 border-t border-slate-800 bg-slate-950/50 rounded-lg p-3">
                    <p className="text-sm text-slate-300 leading-relaxed">{article.abstract}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveArticle(null); }}
                      className="mt-2 text-xs text-amber-400 underline underline-offset-4 hover:text-amber-300"
                    >
                      Свернуть
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Блоки журнала */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Практические разработки', icon: Award, count: 12 },
          { label: 'Российско-белорусские программы', icon: Users, count: 8 },
          { label: 'Национальные программы', icon: Users, count: 6 },
          { label: 'Объявления', icon: Calendar, count: 15 },
          { label: 'Отчеты о конференциях', icon: BookOpen, count: 9 },
          { label: 'Рецензии на книги', icon: File, count: 7 }
        ].map((item) => (
          <div
            key={item.label}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-amber-500/50 transition"
            onClick={() => onOpenTab?.('dashboard')}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-amber-400">
                <item.icon className="w-4 h-4" />
              </div>
              <span className="text-xs text-slate-400">{item.count}</span>
            </div>
            <h4 className="font-bold text-white text-sm">{item.label}</h4>
          </div>
        ))}
      </div>

      <div className="text-xs text-slate-500 text-center">
        Журнал «Информатика» — оригинальные статьи и информация о практических разработках,
        российско-белорусских и национальных программах в области информатики.
      </div>
    </div>
  );
}
