// Temporary harness: exercises refreshMarketPool against the real engine.
import {
  refreshMarketPool,
  generateCharacter,
  MARKET_POOL_SIZE,
} from "./src/gameEngine.ts";

const pool = [
  generateCharacter("01_north_america"),
  generateCharacter("03_western_europe"),
  generateCharacter("11_east_asia"),
  generateCharacter("07_west_africa"),
  generateCharacter("15_roma"),
];

console.log("start pool size          :", pool.length);
console.log(
  "start acquired count     :",
  pool.filter((c) => c.acquired).length,
);

// Simulate the player hiring two operatives.
const hired = pool.slice(0, 2).map((c) => c.id);
let next = pool.map((c) =>
  hired.includes(c.id) ? { ...c, acquired: true } : c,
);
const visibleAfterHire = next.filter((c) => !c.acquired);
console.log(
  "visible after 2 hires    :",
  visibleAfterHire.length,
  "(expected 3)",
);

// Advance a week -> the Global Marketplace fully restocks to MARKET_POOL_SIZE.
const beforeIds = new Set(next.map((c) => c.id));
next = refreshMarketPool(next);
const visibleAfterWeek = next.filter((c) => !c.acquired);
console.log(
  "visible after advanceWeek:",
  visibleAfterWeek.length,
  "(expected",
  MARKET_POOL_SIZE + ")",
);

// Every slot is a brand-new face; no unacquired operative from last week survives.
const survivors = next.filter((c) => beforeIds.has(c.id) && !c.acquired);
console.log("no survivors from last week:", survivors.length === 0);

const hiredStillOffered = next.some((c) => hired.includes(c.id) && !c.acquired);
console.log("hired ids no longer offered:", !hiredStillOffered);
console.log(
  "no duplicate portraits   :",
  new Set(next.map((c) => c.image)).size === next.length,
);
console.log(
  "all have regions         :",
  next.every((c) => c.region && c.regionName),
);

// Full churn: every slot acquired at once.
const allHired = next.map((c) => ({ ...c, acquired: true }));
const churned = refreshMarketPool(allHired);
console.log(
  "full churn size          :",
  churned.length,
  "(expected",
  MARKET_POOL_SIZE + ")",
);
console.log(
  "full churn all fresh     :",
  churned.every((c) => !c.acquired),
);
console.log(
  "full churn unique faces  :",
  new Set(churned.map((c) => c.image)).size === churned.length,
);