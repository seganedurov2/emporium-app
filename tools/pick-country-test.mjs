// Verifies pickCountry() returns a valid country for every region the game can
// generate, and samples the distribution to prove the full pool is reachable.
import { readFileSync } from "node:fs";

const src = readFileSync("E:/emporium/app/src/gameEngine.ts", "utf8");

// --- extract REGION_COUNTRIES from source (no TS runtime needed) ---
const start = src.indexOf("export const REGION_COUNTRIES");
const end = src.indexOf("\n};", start);
const block = src.slice(start, end);
const chunks = block.split(/\n  (?=')/).slice(1);
const pools = new Map();
for (const chunk of chunks) {
  const regionId = /^'([0-9a-z_]+)':/.exec(chunk)?.[1];
  const body = chunk.slice(chunk.indexOf("["));
  pools.set(
    regionId,
    [...body.matchAll(/'([^']+)'/g)].map((x) => x[1]),
  );
}

// --- replicate pickCountry exactly as it is written in the source ---
const pickCountry = (regionId) => {
  const pool = pools.get(regionId);
  if (!pool || pool.length === 0) return "Unknown";
  return pool[Math.floor(Math.random() * pool.length)];
};

// The region ids the game can generate characters for.
const regionIds = [
  ...src.matchAll(/\{ id: '([^']+)', name: '[^']+', code: '/g),
].map((x) => x[1]);

const perRegion = regionIds.map((regionId) => {
  const pool = pools.get(regionId) || [];
  const seen = new Set();
  // 2000 draws: every country in the pool should be reachable.
  for (let i = 0; i < 2000; i++) seen.add(pickCountry(regionId));
  return {
    regionId,
    poolSize: pool.length,
    distinctDrawn: seen.size,
    allReachable: seen.size === pool.length,
    unknownCount: [...seen].filter((c) => c === "Unknown").length,
    sample: [...seen].slice(0, 6),
  };
});

const broken = perRegion.filter(
  (r) => !r.allReachable || r.unknownCount > 0 || r.poolSize === 0,
);

// Edge cases
const edges = {
  unknownRegion: pickCountry("does_not_exist"),
  emptyRegionId: pickCountry(""),
  ceoIsKnown: pickCountry("99_ceo"),
};

console.log(
  JSON.stringify(
    {
      regionsInGame: regionIds.length,
      poolsDefined: [...pools.keys()].length,
      regionIds,
      totalCountriesAcrossPools: [...pools.values()].reduce(
        (s, p) => s + p.length,
        0,
      ),
      uniqueCountryNames: new Set([...pools.values()].flat()).size,
      brokenRegions: broken,
      edges,
      perRegion,
    },
    null,
    2,
  ),
);
