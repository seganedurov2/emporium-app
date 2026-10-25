// Verifies the age field: range 18-60, both bounds reachable, all values hit.
import { readFileSync } from "node:fs";

const src = readFileSync("E:/emporium/app/src/gameEngine.ts", "utf8");

// Replicate pickAge() exactly as written in the source.
const body = /export function pickAge\(\): number \{\s*return ([^;]+);/.exec(
  src,
);
if (!body) throw new Error("pickAge not found in gameEngine.ts");
const pickAge = new Function(`return ${body[1]}`);
console.log("pickAge body from source:", body[1].trim());

const N = 400000;
const counts = new Map();
let min = Infinity;
let max = -Infinity;

for (let i = 0; i < N; i++) {
  const a = pickAge();
  min = Math.min(min, a);
  max = Math.max(max, a);
  counts.set(a, (counts.get(a) || 0) + 1);
}

const values = [...counts.keys()].sort((a, b) => a - b);
const expected = Array.from({ length: 43 }, (_, i) => i + 18);
const missing = expected.filter((v) => !counts.has(v));
const outOfRange = values.filter((v) => v < 18 || v > 60);
const nonInteger = values.filter((v) => !Number.isInteger(v));

// Uniformity check: each of the 43 values should land near 1/43 of the draws.
const ideal = N / 43;
const deviations = values.map((v) => ({
  v,
  dev: Math.abs(counts.get(v) - ideal) / ideal,
}));
const worstDeviation = deviations.reduce(
  (m, d) => (d.dev > m.dev ? d : m),
  deviations[0],
);

console.log(
  JSON.stringify(
    {
      draws: N,
      min,
      max,
      rangeOk: min === 18 && max === 60,
      distinctValues: values.length,
      expectedDistinct: 43,
      missingValues: missing,
      outOfRange,
      nonInteger,
      worstDeviationPct: +(worstDeviation.dev * 100).toFixed(2) + "%",
      worstValue: worstDeviation.v,
      sampleCounts: values
        .slice(0, 5)
        .map((v) => ({ age: v, count: counts.get(v) })),
    },
    null,
    2,
  ),
);
