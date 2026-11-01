export interface ModManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  /** Minimal game version this mod is compatible with. */
  minGameVersion: string;
}

export interface ModHooks {
  /** Called when the mod is registered; can register custom logic. */
  onRegister?: (api: ModApi) => void;
  /** Called before weekly advance; can mutate economy numbers. */
  onWeeklyAdvance?: (ctx: ModWeeklyContext) => void;
  /** Called when a market price is calculated; returns adjusted price or undefined to skip. */
  onMarketPrice?: (ctx: ModPriceContext) => number | undefined;
  /** Called when warehouse capacity is checked; returns adjusted capacity or undefined to skip. */
  onWarehouseCapacity?: (ctx: ModWarehouseContext) => number | undefined;
}

export interface ModApi {
  registerSound: (id: string, fn: () => void) => void;
  log: (msg: string) => void;
}

export interface ModWeeklyContext {
  week: number;
  funds: number;
  warehouseLevel: number;
  addFunds: (delta: number) => void;
  addLog: (msg: string) => void;
}

export interface ModPriceContext {
  basePrice: number;
  demand: number;
  standing: number;
  warehouseLevel: number;
}

export interface ModWarehouseContext {
  level: number;
  capacity: number;
  occupancy: number;
}

export interface RegisteredMod {
  manifest: ModManifest;
  hooks: ModHooks;
  enabled: boolean;
}

class ModLoader {
  private mods = new Map<string, RegisteredMod>();
  private sounds = new Map<string, () => void>();

  register(manifest: ModManifest, hooks: ModHooks): void {
    if (this.mods.has(manifest.id)) {
      console.warn(`Mod ${manifest.id} already registered, skipping.`);
      return;
    }
    const api: ModApi = {
      registerSound: (id, fn) => { this.sounds.set(id, fn); },
      log: (msg) => console.log(`[Mod ${manifest.id}] ${msg}`)
    };
    hooks.onRegister?.(api);
    this.mods.set(manifest.id, { manifest, hooks, enabled: true });
    console.log(`Mod registered: ${manifest.name} v${manifest.version} (${manifest.id})`);
  }

  enable(id: string): boolean {
    const mod = this.mods.get(id);
    if (!mod) return false;
    mod.enabled = true;
    return true;
  }

  disable(id: string): boolean {
    const mod = this.mods.get(id);
    if (!mod) return false;
    mod.enabled = false;
    return true;
  }

  isEnabled(id: string): boolean {
    return this.mods.get(id)?.enabled ?? false;
  }

  list(): RegisteredMod[] {
    return Array.from(this.mods.values());
  }

  /** Calls onWeeklyAdvance on every enabled mod. */
  runWeeklyAdvance(ctx: ModWeeklyContext): void {
    for (const mod of this.list()) {
      if (!mod.enabled) continue;
      try {
        mod.hooks.onWeeklyAdvance?.(ctx);
      } catch (err) {
        console.error(`Mod ${mod.manifest.id} weekly advance error:`, err);
      }
    }
  }

  /** Calls onMarketPrice on every enabled mod; returns the first non-undefined price. */
  applyMarketPrice(ctx: ModPriceContext): number | undefined {
    for (const mod of this.list()) {
      if (!mod.enabled) continue;
      try {
        const price = mod.hooks.onMarketPrice?.(ctx);
        if (price !== undefined) return price;
      } catch (err) {
        console.error(`Mod ${mod.manifest.id} market price error:`, err);
      }
    }
    return undefined;
  }

  /** Calls onWarehouseCapacity on every enabled mod; returns the first non-undefined capacity. */
  applyWarehouseCapacity(ctx: ModWarehouseContext): number | undefined {
    for (const mod of this.list()) {
      if (!mod.enabled) continue;
      try {
        const capacity = mod.hooks.onWarehouseCapacity?.(ctx);
        if (capacity !== undefined) return capacity;
      } catch (err) {
        console.error(`Mod ${mod.manifest.id} warehouse capacity error:`, err);
      }
    }
    return undefined;
  }

  playSound(id: string): void {
    const fn = this.sounds.get(id);
    if (fn) fn();
  }
}

export const modLoader = new ModLoader();
