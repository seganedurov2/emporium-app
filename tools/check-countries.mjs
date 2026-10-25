// Validates REGION_COUNTRIES: every region covered, no duplicates, no empties.
import { readFileSync } from 'node:fs'

const src = readFileSync('E:/emporium/app/src/gameEngine.ts', 'utf8')

// Pull the array literal out of the source without importing TS.
const start = src.indexOf('export const REGION_COUNTRIES')
const end = src.indexOf('\n};', start)
const block = src.slice(start, end)

// Region keys always sit at two-space indent, so split on those boundaries.
const chunks = block.split(/\n  (?=')/).slice(1)
const entries = chunks.map(chunk => {
  const regionId = /^'([0-9a-z_]+)':/.exec(chunk)?.[1]
  const body = chunk.slice(chunk.indexOf('['))
  const countries = [...body.matchAll(/'([^']+)'/g)].map(x => x[1])
  return { regionId, countries }
})

// The region ids the game can actually generate.
const regionsStart = src.indexOf('export const REGIONS')
const regionsEnd = src.indexOf('];', regionsStart)
const regionsBlock = src.slice(regionsStart, regionsEnd)
const regionIds = [...regionsBlock.matchAll(/\{ id: '([^']+)', name:/g)].map(x => x[1])

const report = {
  regionsInGame: regionIds.length,
  poolsDefined: entries.length,
  missingPool: regionIds.filter(id => !entries.some(e => e.regionId === id)),
  perRegion: entries.map(e => ({ region: e.regionId, count: e.countries.length })),
  totalUniqueCountries: new Set(entries.flatMap(e => e.countries)).size,
  totalEntries: entries.reduce((s, e) => s + e.countries.length, 0),
  emptyPools: entries.filter(e => e.countries.length === 0).map(e => e.regionId),
  duplicatesWithinPool: entries
    .map(e => ({ region: e.regionId, dupes: e.countries.filter((c, i) => e.countries.indexOf(c) !== i) }))
    .filter(e => e.dupes.length > 0),
  shortestPool: entries.reduce((min, e) => (e.countries.length < min.countries.length ? e : min)),
}

console.log(JSON.stringify(report, null, 2))
