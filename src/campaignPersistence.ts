/**
 * Campaign save/load I/O, lifted out of App.tsx.
 *
 * The functions here only touch localStorage and the data-protection layer;
 * they never touch React. App keeps the React state and calls these to move a
 * campaign between memory and a slot, which keeps the storage format byte-for-
 * byte identical to what the app wrote before the extraction:
 * - the same slot key (`emporium_save_slot_<n>`), the same legacy fallback
 *   (`emporium_save_06` for slot 1);
 * - the same plain JSON body when encryption at rest is off;
 * - the same iv||ciphertext body when it is on and a session key exists.
 *
 * Migration (`migrateCampaignState`) stays where it was, in `saveState.ts`.
 */

import {
  audit,
  decryptAsync,
  encrypt,
  hasSessionKey,
  loadDataProtection,
} from "./dataProtection";

export interface SaveSlotInfo {
  slotNumber: number;
  campaignName: string;
  week: number;
  funds: number;
  timestamp: string;
  exists: boolean;
}

/** Pre-0.3 slot name, still read for slot 1 so old campaigns are not lost. */
export const LEGACY_SLOT_1_KEY = "emporium_save_06";

export const getSlotKey = (slotNum: number): string =>
  `emporium_save_slot_${slotNum}`;

/** Result of reading a slot: the parsed raw value, or a reason it failed. */
export type SlotReadResult =
  | { ok: true; data: unknown; slotNum: number }
  | {
      ok: false;
      reason: "empty" | "undecryptable" | "corrupt";
      slotNum: number;
    };

/** Serializes a campaign the way every save path always did. */
async function serializeCampaign(nextState: unknown): Promise<string> {
  const dp = loadDataProtection();
  return dp.encryption_at_rest && hasSessionKey()
    ? encrypt(JSON.stringify(nextState))
    : JSON.stringify(nextState);
}

export function readSlotText(slotNum: number): string | null {
  return (
    localStorage.getItem(getSlotKey(slotNum)) ||
    (slotNum === 1 ? localStorage.getItem(LEGACY_SLOT_1_KEY) : null)
  );
}

/** Writes a campaign object to a slot. Returns the serialized body. */
export async function writeSlot(
  slotNum: number,
  state: unknown,
): Promise<string> {
  const serialized = await serializeCampaign(state);
  localStorage.setItem(getSlotKey(slotNum), serialized);
  return serialized;
}

/** Slot summaries for the load/save dialog. Nothing is migrated here. */
export function getSlotInfo(slotNum: number): SaveSlotInfo {
  const data = readSlotText(slotNum);
  if (!data) {
    return {
      slotNumber: slotNum,
      campaignName: "Пустой слот",
      week: 0,
      funds: 0,
      timestamp: "",
      exists: false,
    };
  }
  try {
    const parsed = JSON.parse(data);
    return {
      slotNumber: slotNum,
      campaignName: parsed.campaignName || "Синдикат Эмпориум",
      week: parsed.week || 1,
      funds: parsed.funds || 0,
      timestamp: parsed.timestamp || new Date().toLocaleString(),
      exists: true,
    };
  } catch {
    return {
      slotNumber: slotNum,
      campaignName: "Повреждённое сохранение",
      week: 0,
      funds: 0,
      timestamp: "",
      exists: false,
    };
  }
}

/**
 * Reads and decrypts a slot. The caller runs `migrateCampaignState` on the
 * returned value, so the migration rules stay in one module.
 */
export async function readSlot(slotNum: number): Promise<SlotReadResult> {
  const raw = readSlotText(slotNum);
  if (!raw) return { ok: false, reason: "empty", slotNum };

  let text = raw;
  const dp = loadDataProtection();
  if (dp.encryption_at_rest && hasSessionKey()) {
    try {
      const decrypted = await decryptAsync(raw);
      if (decrypted === raw)
        return { ok: false, reason: "undecryptable", slotNum };
      text = decrypted;
    } catch {
      return { ok: false, reason: "undecryptable", slotNum };
    }
  }

  try {
    return { ok: true, data: JSON.parse(text), slotNum };
  } catch {
    return { ok: false, reason: "corrupt", slotNum };
  }
}

/** Removes a slot from storage. */
export function deleteSlot(slotNum: number): void {
  localStorage.removeItem(getSlotKey(slotNum));
}

/**
 * Autosave: writes the current campaign to its own slot. The timestamp is part
 * of the saved body, as it always was.
 */
export async function autosaveCampaign<T extends object & { slot?: number }>(state: T): Promise<string> {
  const slotNum = state.slot || 1;
  const serialized = await writeSlot(slotNum, {
    ...state,
    timestamp: new Date().toLocaleString(),
  });
  audit("campaign_auto_save", `slot ${slotNum}`);
  return serialized;
}

/** Manual save into a slot, without the autosave audit entry. */
export async function saveCampaignToSlot(
  slotNum: number,
  state: unknown,
): Promise<string> {
  const serialized = await writeSlot(slotNum, state);
  audit("campaign_save_slot", String(slotNum));
  return serialized;
}

/** Records a successful manual load in the audit trail. */
export function auditSlotLoad(slotNum: number): void {
  audit("campaign_load_slot", String(slotNum));
}
