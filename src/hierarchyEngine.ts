import type { Character, CampaignState } from './gameEngine';

/**
 * Logic for managing the internal hierarchy of the syndicate.
 */

/**
 * Promotes a character to the role of an overseer.
 * Only characters with high loyalty and skill are typically suitable.
 */
export function promoteToOverseer(state: CampaignState, charId: string): CampaignState {
  const char = state.roster.find(c => c.id === charId);
  if (!char) return state;

  const newRoster = state.roster.map(c => 
    c.id === charId ? { ...c, managerialRole: 'overseer' as const } : c
  );

  return { ...state, roster: newRoster };
}

/**
 * Demotes a character from the overseer role.
 */
export function demoteFromOverseer(state: CampaignState, charId: string): CampaignState {
  const newRoster = state.roster.map(c => 
    c.id === charId ? { ...c, managerialRole: 'none' as const } : c
  );

  return { ...state, roster: newRoster };
}

/**
 * Assigns a specific overseer to manage a subordinate character.
 * Validation: A character cannot manage themselves.
 */
export function assignOverseer(state: CampaignState, overseerId: string, subordinateId: string): CampaignState {
  if (overseerId === subordinateId) return state;

  const overseer = state.roster.find(c => c.id === overseerId);
  if (!overseer || overseer.managerialRole !== 'overseer') {
    console.error("Character must be an overseer to manage others.");
    return state;
  }

  const newRoster = state.roster.map(c => 
    c.id === subordinateId ? { ...c, managedBy: overseerId } : c
  );

  return { ...state, roster: newRoster };
}

/**
 * Removes the link between a subordinate and their overseer.
 */
export function removeOverseerLink(state: CampaignState, subordinateId: string): CampaignState {
  const newRoster = state.roster.map(c => 
    c.id === subordinateId ? { ...c, managedBy: null } : c
  );

  return { ...state, roster: newRoster };
}

/**
 * When an overseer is sold or leaves the syndicate, 
 * all their subordinates must be left unmanaged.
 */
export function clearAllSubordinates(state: CampaignState, overseerId: string): CampaignState {
  const newRoster = state.roster.map(c => 
    c.managedBy === overseerId ? { ...c, managedBy: null } : c
  );

  return { ...state, roster: newRoster };
}

/**
 * Returns a list of all characters currently managed by a specific overseer.
 */
export function getSubordinates(state: CampaignState, overseerId: string): Character[] {
  return state.roster.filter(c => c.managedBy === overseerId);
}
