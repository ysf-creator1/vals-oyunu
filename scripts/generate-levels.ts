/**
 * Generates the campaign levels with a fixed seed into src/data/levels.json.
 * The file is committed so levels never change between releases.
 * Run: npm run gen:levels
 *
 * 40 levels per band are generated; copies of the same puzzle (shifted, turned or mirrored) are then
 * dropped, keeping the first one. Kept levels keep their generated id (so ids have gaps), which keeps
 * players' progress and the server's per-level times valid. Dropped ids map to the kept copy in
 * src/data/level-aliases.json, so a result saved under a dropped id moves to its twin.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generate, shapeKey } from '../src/engine/generator';
import { mulberry32 } from '../src/engine/rng';
import { solve } from '../src/engine/solver';
import type { Level } from '../src/engine/types';
import { BANDS } from '../src/progression/bands';

export const CAMPAIGN_SEED = 20261114;
export const GENERATED_PER_BAND = 40;

const generatedId = (band: string, index: number) => `${band}-${String(index + 1).padStart(3, '0')}`;

export function generateCampaign(seed = CAMPAIGN_SEED): Level[] {
  const rng = mulberry32(seed);
  const out: Level[] = [];
  for (const band of BANDS) {
    const seen = new Set<string>();
    for (let i = 0; i < GENERATED_PER_BAND; i++) {
      out.push(generate(band.config, rng, seen, { id: generatedId(band.id, i), band: band.id }));
    }
  }
  return out;
}

/** Drop repeated puzzles within each band. Returns the kept levels and dropped id → kept id. */
export function dedupeCampaign(levels: Level[]): { levels: Level[]; aliases: Record<string, string> } {
  const kept: Level[] = [];
  const aliases: Record<string, string> = {};
  const first = new Map<string, string>();
  for (const l of levels) {
    const key = `${l.band}|${shapeKey(l.stones)}`;
    const twin = first.get(key);
    if (twin) aliases[l.id] = twin;
    else {
      first.set(key, l.id);
      kept.push(l);
    }
  }
  return { levels: kept, aliases };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const t0 = performance.now();
  const { levels, aliases } = dedupeCampaign(generateCampaign());
  for (const l of levels) {
    const { solutions } = solve(l);
    if (solutions.length !== 1 || solutions[0].join() !== l.solution.join()) throw new Error(`verify failed: ${l.id}`);
  }
  for (const b of BANDS) {
    const ns = levels.filter((l) => l.band === b.id).map((l) => l.nodes).sort((a, c) => a - c);
    console.log(`${b.id}: ${ns.length} levels, nodes median ${ns[ns.length >> 1]}, max ${ns[ns.length - 1]}`);
  }
  // One level per line: small diffs, readable file.
  const json = '[\n' + levels.map((l) => JSON.stringify(l)).join(',\n') + '\n]\n';
  writeFileSync(fileURLToPath(new URL('../src/data/levels.json', import.meta.url)), json);
  writeFileSync(fileURLToPath(new URL('../src/data/level-aliases.json', import.meta.url)), JSON.stringify(aliases, null, 1) + '\n');
  console.log(`${levels.length} levels (${Object.keys(aliases).length} repeats dropped) in ${Math.round(performance.now() - t0)} ms`);
}
