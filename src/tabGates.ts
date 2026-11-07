import type { AppTab } from './appNavigation';
import type { ManagedCampaignState } from './saveState';
import { QUESTS, type QuestState } from './quests';

/** Tabs always available regardless of quest progress. */
export const ALWAYS_UNLOCKED_TABS: ReadonlySet<AppTab> = new Set([
  'dashboard',
  'finances',
  'meta',
  'game_control',
  'board',
  'roster',
  'market',
]);

/**
 * Quest → tabs it unlocks when completed.
 * Tabs not listed here and not in ALWAYS_UNLOCKED_TABS are unlocked by the
 * first quest whose objectives can be pursued (to avoid deadlocks) or by
 * completing the mapped quest.
 */
export const QUEST_UNLOCKS: Record<string, AppTab[]> = {
  build_school: ['school', 'school_kindergarten', 'self_development', 'hiring', 'staff', 'facilities_staff'],
  hire_teacher: ['hospital', 'salon', 'rest_zone'],
  upgrade_clinic: ['correction_center'],
  build_auction_house: ['auction_house', 'slave_market', 'supply_contracts', 'contracts'],
  buy_second_territory: ['mezzanine', 'regions', 'warehouse_mezzanine', 'mezzanine_journal', 'boiler_house'],
  hire_auctioneer: ['caravans', 'capture_ops', 'security_service'],
  build_bdsm_room: ['bdsm_room', 'pleasure_house_prisoners', 'trait_chats'],
  build_self_development: ['self_development'],
  build_guard_post: ['security_service'],
  build_hospital: ['hospital'],
  build_legal_dept: ['board'],
  reach_reputation_50: ['strip_club', 'wasteland'],
  reach_funds_100000: [],
  reach_reputation_100: [],
  reach_funds_250000: [],
};

/** Tabs required to pursue a quest's objectives (must be open while quest is active/available). */
export const QUEST_REQUIRED_TABS: Record<string, AppTab[]> = {
  build_school: ['board', 'facilities_staff'],
  hire_teacher: ['hiring', 'staff', 'school'],
  upgrade_clinic: ['hospital', 'board'],
  build_auction_house: ['board', 'auction_house'],
  buy_second_territory: ['mezzanine', 'regions'],
  hire_auctioneer: ['hiring', 'staff', 'auction_house'],
  build_bdsm_room: ['board', 'bdsm_room'],
  build_self_development: ['board', 'facilities_staff'],
  build_guard_post: ['board', 'facilities_staff'],
  build_hospital: ['board', 'facilities_staff'],
  build_legal_dept: ['board', 'facilities_staff'],
  reach_reputation_50: [],
  reach_funds_100000: ['finances', 'market'],
  reach_reputation_100: [],
  reach_funds_250000: ['finances', 'market'],
};

export function isTabUnlocked(tab: AppTab, quests: QuestState[] | undefined, state?: ManagedCampaignState): boolean {
  if (ALWAYS_UNLOCKED_TABS.has(tab)) return true;
  const list = quests ?? [];
  // Legacy/veteran saves: if the player is far along, don't gate.
  if (isLegacyProgress(list, state)) return true;

  // Unlocked if any completed quest grants it.
  for (const qs of list) {
    if (qs.status !== 'completed') continue;
    const unlocks = QUEST_UNLOCKS[qs.id];
    if (unlocks?.includes(tab)) return true;
  }
  // Unlocked if it's required to pursue any currently active/visible quest.
  for (const q of QUESTS) {
    const qs = list.find((s) => s.id === q.id);
    const status = qs?.status ?? 'active';
    if (status === 'completed' || status === 'failed') continue;
    const depsOk = !q.dependsOn || list.find((s) => s.id === q.dependsOn)?.status === 'completed';
    if (!depsOk) continue;
    const req = QUEST_REQUIRED_TABS[q.id];
    if (req?.includes(tab)) return true;
    // First quest's unlock targets that are also needed? keep build path open
    if (q.id === 'build_school' && (tab === 'facilities_staff' || tab === 'hiring' || tab === 'staff')) return true;
  }
  // If no gate mapping references this tab at all, keep it open.
  const gated = new Set<AppTab>();
  for (const tabs of Object.values(QUEST_UNLOCKS)) for (const t of tabs) gated.add(t);
  if (!gated.has(tab)) return true;
  return false;
}

function isLegacyProgress(quests: QuestState[], state?: ManagedCampaignState): boolean {
  // Saves from before gating: if the player completed several of the original
  // quests or is deep into the campaign, don't lock tabs retroactively.
  const completed = quests.filter((q) => q.status === 'completed').length;
  if (completed >= 3) return true;
  if (state && (state.week ?? 0) >= 20) return true;
  return false;
}

export function getTabLockReason(tab: AppTab, quests: QuestState[] | undefined): string | null {
  const list = quests ?? [];
  for (const [questId, unlocks] of Object.entries(QUEST_UNLOCKS)) {
    if (!unlocks.includes(tab)) continue;
    const q = QUESTS.find((x) => x.id === questId);
    const qs = list.find((s) => s.id === questId);
    if (qs?.status === 'completed') continue;
    if (q) return `Выполните задание: «${q.title}»`;
  }
  return 'Выполните задание, чтобы открыть раздел';
}
