/**
 * Backup / restore for campaign saves, settings and data protection.
 *
 * A backup bundle is a single JSON object:
 *   {
 *     version: 1,
 *     exportedAt: number,
 *     slots: { [slotKey: string]: string },   // raw or encrypted slot payload
 *     settings: AppSettings,
 *     dataProtection: DataProtectionSettings,
 *     auditTrail: AuditEntry[]
 *   }
 *
 * When a session key is available and encryption_at_rest is on, slot
 * payloads are already encrypted at rest, so the bundle stores them as-is.
 * Otherwise the whole bundle can be wrapped in an optional passphrase
 * layer (AES-GCM) for off-site transport.
 */

import { encrypt, decryptAsync, loadDataProtection } from './dataProtection';
import type { AppSettings } from './settings';
import type { DataProtectionSettings } from './dataProtection';

export interface AuditEntry {
  ts: number;
  event: string;
  detail?: string;
}

export interface BackupBundle {
  version: number;
  exportedAt: number;
  slots: Record<string, string>;
  settings: AppSettings;
  dataProtection: DataProtectionSettings;
  auditTrail: AuditEntry[];
}

const BACKUP_VERSION = 1;
const SLOT_PREFIX = 'emporium_save_slot_';
const LEGACY_SLOT_KEY = 'emporium_save_06';
const SETTINGS_KEY = 'emporium_settings';
const DP_KEY = 'emporium_data_protection';
const AUDIT_KEY = 'emporium_audit_trail';

/** Collect every persisted slot (1-5) plus the legacy slot 06 if present. */
function collectSlots(): Record<string, string> {
  const slots: Record<string, string> = {};
  for (let i = 1; i <= 5; i++) {
    const key = `${SLOT_PREFIX}${i}`;
    const value = localStorage.getItem(key);
    if (value) slots[key] = value;
  }
  const legacy = localStorage.getItem(LEGACY_SLOT_KEY);
  if (legacy) slots[LEGACY_SLOT_KEY] = legacy;
  return slots;
}

/** Write collected slots back into localStorage. */
function restoreSlots(slots: Record<string, string>): void {
  for (const [key, value] of Object.entries(slots)) {
    try {
      localStorage.setItem(key, value);
    } catch { /* storage unavailable */ }
  }
}

/** Build an unencrypted backup bundle from everything in localStorage. */
export function buildBackupBundle(): BackupBundle {
  return {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    slots: collectSlots(),
    settings: (() => {
      try {
        return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as AppSettings;
      } catch {
        return {} as AppSettings;
      }
    })(),
    dataProtection: loadDataProtection(),
    auditTrail: (() => {
      try {
        return JSON.parse(localStorage.getItem(AUDIT_KEY) || '[]') as AuditEntry[];
      } catch {
        return [];
      }
    })()
  };
}

/** Serialize a bundle to a JSON string. */
export function serializeBundle(bundle: BackupBundle): string {
  return JSON.stringify(bundle, null, 2);
}

/** Parse a bundle from a JSON string, validating shape. */
export function parseBundle(json: string): BackupBundle | null {
  try {
    const parsed = JSON.parse(json) as BackupBundle;
    if (parsed.version !== BACKUP_VERSION) return null;
    if (!parsed.slots || typeof parsed.slots !== 'object') return null;
    if (!parsed.settings || typeof parsed.settings !== 'object') return null;
    if (!parsed.dataProtection || typeof parsed.dataProtection !== 'object') return null;
    if (!Array.isArray(parsed.auditTrail)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Export a backup bundle to a downloadable file. If `passphrase` is given,
 *  the whole bundle is AES-GCM encrypted before download. */
export async function exportBackup(passphrase?: string): Promise<string> {
  const bundle = buildBackupBundle();
  const json = serializeBundle(bundle);
  const payload = passphrase
    ? await encrypt(json)
    : json;
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const fileName = `emporium_backup_${new Date().toISOString().slice(0, 10)}${passphrase ? '.enc' : '.json'}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return fileName;
}

/** Import a backup bundle from a File. If `passphrase` is given, attempt
 *  decryption first. Returns the parsed bundle or null on failure. */
export async function importBackupFile(file: File, passphrase?: string): Promise<BackupBundle | null> {
  const text = await file.text();
  let json = text;
  if (passphrase) {
    const decrypted = await decryptAsync(text);
    if (decrypted === text) return null; // decryption failed / wrong passphrase
    json = decrypted;
  }
  return parseBundle(json);
}

/** Restore a parsed bundle into localStorage (slots, settings, data protection). */
export function restoreBackupBundle(bundle: BackupBundle): void {
  restoreSlots(bundle.slots);
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(bundle.settings));
  } catch { /* storage unavailable */ }
  try {
    localStorage.setItem(DP_KEY, JSON.stringify(bundle.dataProtection));
  } catch { /* storage unavailable */ }
  try {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(bundle.auditTrail));
  } catch { /* storage unavailable */ }
}
