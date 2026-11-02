/**
 * Data protection for distributed warehouse management systems.
 *
 * Provides AES-GCM encryption/decryption for campaign saves and settings
 * stored in localStorage (encryption at rest), plus helpers to derive a
 * key from a user passphrase. Intended for multi-node / cloud-synced
 * warehouse deployments where save files may travel across untrusted
 * storage or be backed up off-site.
 *
 * All operations are synchronous except key derivation (PBKDF2) which is
 * async; encrypt/decrypt themselves are synchronous once the key exists.
 */

const STORAGE_KEY = 'emporium_data_protection';

export interface DataProtectionSettings {
  /** Encrypt campaign saves and app settings before writing to localStorage. */
  encryption_at_rest: boolean;
  /** Require WSS (TLS) for multiplayer WebSocket connections. */
  tls_wss: boolean;
  /** Log every read/write of protected data to an audit trail. */
  audit_log: boolean;
}

export const DEFAULT_DATA_PROTECTION: DataProtectionSettings = {
  encryption_at_rest: false,
  tls_wss: false,
  audit_log: false
};

interface StoredProtection {
  encryption_at_rest: boolean;
  tls_wss: boolean;
  audit_log: boolean;
  /** Salt used for PBKDF2 key derivation, base64. */
  salt?: string;
}

/** Raw key material held in memory only. Never written to disk. */
let sessionKey: CryptoKey | null = null;

export function loadDataProtection(): DataProtectionSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DATA_PROTECTION };
    const parsed = JSON.parse(raw) as Partial<StoredProtection>;
    return {
      encryption_at_rest:
        typeof parsed.encryption_at_rest === 'boolean'
          ? parsed.encryption_at_rest
          : DEFAULT_DATA_PROTECTION.encryption_at_rest,
      tls_wss:
        typeof parsed.tls_wss === 'boolean'
          ? parsed.tls_wss
          : DEFAULT_DATA_PROTECTION.tls_wss,
      audit_log:
        typeof parsed.audit_log === 'boolean'
          ? parsed.audit_log
          : DEFAULT_DATA_PROTECTION.audit_log
    };
  } catch {
    return { ...DEFAULT_DATA_PROTECTION };
  }
}

export function saveDataProtection(settings: DataProtectionSettings): void {
  try {
    const stored: StoredProtection = {
      encryption_at_rest: settings.encryption_at_rest,
      tls_wss: settings.tls_wss,
      audit_log: settings.audit_log
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch { /* storage unavailable */ }
}

export function audit(event: string, detail?: string): void {
  const enabled = loadDataProtection().audit_log;
  if (!enabled) return;
  try {
    const trail = JSON.parse(localStorage.getItem('emporium_audit_trail') || '[]') as Array<{
      ts: number; event: string; detail?: string;
    }>;
    trail.push({ ts: Date.now(), event, detail });
    localStorage.setItem('emporium_audit_trail', JSON.stringify(trail.slice(-500)));
  } catch { /* storage unavailable */ }
}

/** Derive an AES-GCM key from a passphrase using PBKDF2. */
async function deriveKey(passphrase: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const imported = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 250_000, hash: 'SHA-256' },
    imported,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function getSalt(): ArrayBuffer {
  const existing = localStorage.getItem('emporium_dp_salt');
  if (existing) {
    const bytes = Uint8Array.from(atob(existing), c => c.charCodeAt(0));
    return bytes.buffer;
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  try {
    localStorage.setItem('emporium_dp_salt', btoa(String.fromCharCode(...salt)));
  } catch { /* storage unavailable */ }
  return salt.buffer;
}

/** Initialize the in-memory session key from a user passphrase. */
export async function initSessionKey(passphrase: string): Promise<void> {
  const salt = getSalt();
  sessionKey = await deriveKey(passphrase, salt);
  audit('session_key_derived');
}

/** Clear the in-memory session key (logout / lock). */
export function clearSessionKey(): void {
  sessionKey = null;
  audit('session_key_cleared');
}

export function hasSessionKey(): boolean {
  return sessionKey !== null;
}

/** Encrypt a string. Returns base64 of iv||ciphertext, or plaintext if no key. */
export async function encrypt(plaintext: string): Promise<string> {
  if (!sessionKey) {
    audit('encrypt_skipped_no_key');
    return plaintext;
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    sessionKey,
    encoded
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  audit('encrypt', plaintext.length > 0 ? `${plaintext.length} bytes` : 'empty');
  return btoa(String.fromCharCode(...combined));
}

/** Async decrypt base64 iv||ciphertext. Returns plaintext, or input unchanged if no key. */
export async function decryptAsync(ciphertextB64: string): Promise<string> {
  if (!sessionKey) {
    audit('decrypt_async_skipped_no_key');
    return ciphertextB64;
  }
  let combined: Uint8Array;
  try {
    combined = Uint8Array.from(atob(ciphertextB64), c => c.charCodeAt(0));
  } catch {
    audit('decrypt_async_invalid_b64');
    return ciphertextB64;
  }
  if (combined.length < 13) {
    audit('decrypt_async_too_short');
    return ciphertextB64;
  }
  const iv = combined.slice(0, 12);
  const ct = combined.slice(12);
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      sessionKey,
      ct
    );
    audit('decrypt_async', `${decrypted.byteLength} bytes`);
    return new TextDecoder().decode(decrypted);
  } catch {
    audit('decrypt_async_auth_failed');
    return ciphertextB64;
  }
}

/** Encrypt a JSON-serializable value. */
export async function encryptJson(value: unknown): Promise<string> {
  return encrypt(JSON.stringify(value));
}

/** Decrypt and parse JSON. Returns null on failure or missing key. */
export async function decryptJson<T>(ciphertextB64: string): Promise<T | null> {
  const decrypted = await decryptAsync(ciphertextB64);
  if (decrypted === ciphertextB64) return null;
  try {
    return JSON.parse(decrypted) as T;
  } catch {
    return null;
  }
}

/** Check whether a stored value looks like it was encrypted (base64 with iv prefix). */
export function isEncrypted(value: string | null): boolean {
  if (!value) return false;
  try {
    const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
    return bytes.length >= 13;
  } catch {
    return false;
  }
}

/** WebSocket URL helper: force WSS when TLS is required. */
export function normalizeWsUrl(url: string | null, tlsRequired: boolean): string | null {
  if (!url) return null;
  if (tlsRequired && url.startsWith('ws://')) {
    audit('ws_url_upgraded_to_wss');
    return 'wss://' + url.slice('ws://'.length);
  }
  return url;
}
