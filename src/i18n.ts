/**
 * Minimal i18n for Emporium (Telegram Mini App).
 *
 * Default language: Russian. English translations provided for the
 * settings/modals/skeletons surfaces that were added in this sprint.
 * Full app translation is out of scope — the game UI remains Russian.
 */

export type Lang = 'ru' | 'en';

const DICTIONARIES: Record<Lang, Record<string, string>> = {
  ru: {
    // Theme
    'theme.light': 'Светлая тема',
    'theme.dark': 'Тёмная тема',

    // Backup
    'backup.title': 'Резервное копирование',
    'backup.hint': 'Экспорт всех сохранений, настроек и журнала аудита в файл. Импорт восстанавливает их из файла.',
    'backup.password.label': 'Пароль шифрования (опционально)',
    'backup.password.placeholder': 'Пароль для зашифрованного бэкапа',
    'backup.import.password.label': 'Пароль импорта (если зашифрован)',
    'backup.import.password.placeholder': 'Пароль для расшифровки',
    'backup.import.file.label': 'Файл бэкапа для импорта',
    'backup.export': 'Экспорт бэкапа',
    'backup.exporting': 'Экспорт…',
    'backup.import': 'Импорт бэкапа',
    'backup.importing': 'Импорт…',
    'backup.done': 'Готово',
    'backup.done.export': 'Сохранено как файл',
    'backup.done.import': 'Восстановлено из файла',
    'backup.error': 'Ошибка',

    // Error boundary
    'error.title': 'Ошибка в компоненте',
    'error.retry': 'Попробовать снова',
    'error.unknown': 'Неизвестная ошибка',

    // Mezzanine report
    'report.title': 'Технический отчёт по мезонину',
    'report.object': 'Объект',
    'report.region': 'Регион',
    'report.city': 'Город',
    'report.params': 'Параметры расчёта',
    'report.load': 'Несущая способность пола',
    'report.fire': 'Огнестойкость конструкций',
    'report.height': 'Высота потолка',
    'report.tiers': 'Количество ярусов',
    'report.aup': 'АУП каждого яруса',
    'report.materials': 'Негорючие материалы',
    'report.result': 'Итог',
    'report.compliant': 'Соответствует нормативам',
    'report.noncompliant': 'Обнаружены нарушения',
    'report.issues': 'Нарушения',
    'report.recommendations': 'Рекомендации',
    'report.stu': 'Требуется СТУ (123-ФЗ ст. 78)',
    'report.footer': 'Сгенерировано в приложении Эмпориум. Отчёт носит информационный характер.'
  },
  en: {
    'theme.light': 'Light theme',
    'theme.dark': 'Dark theme',

    'backup.title': 'Backup',
    'backup.hint': 'Export all saves, settings and audit trail to a file. Import restores them from a file.',
    'backup.password.label': 'Encryption password (optional)',
    'backup.password.placeholder': 'Password for encrypted backup',
    'backup.import.password.label': 'Import password (if encrypted)',
    'backup.import.password.placeholder': 'Password to decrypt',
    'backup.import.file.label': 'Backup file to import',
    'backup.export': 'Export backup',
    'backup.exporting': 'Exporting…',
    'backup.import': 'Import backup',
    'backup.importing': 'Importing…',
    'backup.done': 'Done',
    'backup.done.export': 'Saved to file',
    'backup.done.import': 'Restored from file',
    'backup.error': 'Error',

    'error.title': 'Component error',
    'error.retry': 'Try again',
    'error.unknown': 'Unknown error',

    'report.title': 'Mezzanine technical report',
    'report.object': 'Object',
    'report.region': 'Region',
    'report.city': 'City',
    'report.params': 'Calculation parameters',
    'report.load': 'Floor load capacity',
    'report.fire': 'Fire resistance',
    'report.height': 'Ceiling height',
    'report.tiers': 'Number of tiers',
    'report.aup': 'AUP per tier',
    'report.materials': 'Non-combustible materials',
    'report.result': 'Result',
    'report.compliant': 'Compliant with regulations',
    'report.noncompliant': 'Violations detected',
    'report.issues': 'Violations',
    'report.recommendations': 'Recommendations',
    'report.stu': 'STU required (123-FZ art. 78)',
    'report.footer': 'Generated in the Emporium app. Report is for information only.'
  }
};

let currentLang: Lang = 'ru';

export function setLang(lang: Lang): void {
  currentLang = lang;
}

export function getLang(): Lang {
  return currentLang;
}

export function t(key: string, lang?: Lang): string {
  const l = lang ?? currentLang;
  return DICTIONARIES[l][key] ?? DICTIONARIES['ru'][key] ?? key;
}
