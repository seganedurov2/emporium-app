import type { ManagedCampaignState } from './saveState';

/**
 * Exports the current game state to a JSON file.
 */
export function exportGameSave(state: ManagedCampaignState, fileName: string = 'emporium_save.json'): void {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Imports a game state from a JSON file.
 * Returns the parsed state or null if validation fails.
 */
export function importGameSave(fileContent: string): ManagedCampaignState | null {
  try {
    const parsed = JSON.parse(fileContent);
    // Basic validation: check for essential fields
    if (!parsed || typeof parsed !== 'object' || !parsed.version || !parsed.campaignName) {
      throw new Error('Invalid save file format.');
    }
    return parsed as ManagedCampaignState;
  } catch (e) {
    console.error('Failed to import game save:', e);
    return null;
  }
}
