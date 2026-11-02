import { describe, expect, it, beforeEach } from 'vitest';
import type { AppSettings } from './settings';
import {
  parseBundle,
  serializeBundle,
  buildBackupBundle,
  type BackupBundle
} from './backup';

const mockStorage: Record<string, string> = {};
beforeEach(() => {
  Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
  (globalThis as any).localStorage = {
    getItem: (k: string) => mockStorage[k] ?? null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
    clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
  } as Storage;
});

describe('backup bundle', () => {
  it('serializes and round-trips a bundle', () => {
    const bundle: BackupBundle = {
      version: 1,
      exportedAt: 1234567890,
      slots: { 'emporium_save_slot_1': '{}' },
      settings: { theme: 'dark' } as AppSettings,
      dataProtection: { encryption_at_rest: false, tls_wss: false, audit_log: false },
      auditTrail: []
    };
    const json = serializeBundle(bundle);
    const parsed = parseBundle(json);
    expect(parsed).not.toBeNull();
    expect(parsed!.version).toBe(1);
    expect(parsed!.exportedAt).toBe(1234567890);
    expect(parsed!.slots['emporium_save_slot_1']).toBe('{}');
  });

  it('rejects wrong version', () => {
    const bad = JSON.stringify({ version: 99, slots: {}, settings: {}, dataProtection: {}, auditTrail: [] });
    expect(parseBundle(bad)).toBeNull();
  });

  it('rejects malformed JSON', () => {
    expect(parseBundle('not json')).toBeNull();
  });

  it('rejects missing slots', () => {
    const bad = JSON.stringify({ version: 1, settings: {}, dataProtection: {}, auditTrail: [] });
    expect(parseBundle(bad)).toBeNull();
  });

  it('buildBackupBundle returns correct shape', () => {
    // localStorage may be empty in test env
    const bundle = buildBackupBundle();
    expect(bundle.version).toBe(1);
    expect(typeof bundle.exportedAt).toBe('number');
    expect(typeof bundle.slots).toBe('object');
    expect(typeof bundle.settings).toBe('object');
    expect(typeof bundle.dataProtection).toBe('object');
    expect(Array.isArray(bundle.auditTrail)).toBe(true);
  });
});
