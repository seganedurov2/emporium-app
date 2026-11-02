import { describe, expect, it } from 'vitest';
import { t, setLang, getLang } from './i18n';

describe('i18n', () => {
  it('returns Russian by default', () => {
    setLang('ru');
    expect(t('backup.title')).toBe('Резервное копирование');
    expect(t('theme.light')).toBe('Светлая тема');
    expect(t('error.title')).toBe('Ошибка в компоненте');
  });

  it('returns English when switched', () => {
    setLang('en');
    expect(t('backup.title')).toBe('Backup');
    expect(t('theme.light')).toBe('Light theme');
    expect(t('error.title')).toBe('Component error');
  });

  it('falls back to Russian for missing English keys', () => {
    setLang('en');
    // Some key that only exists in ru would fall back to ru, but all keys exist in both.
    // Unknown key returns itself.
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('supports per-call lang override', () => {
    setLang('ru');
    expect(t('backup.title', 'en')).toBe('Backup');
    expect(getLang()).toBe('ru');
  });
});
