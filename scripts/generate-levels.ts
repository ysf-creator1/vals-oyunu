/**
 * Generates the 480 campaign levels with a fixed seed into src/data/levels.json.
 * The file is committed so levels never change between releases.
 * Run: npm run gen:levels
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { generate } from '../src/engine/generator';
import { mulberry32 } from '../src/engine/rng';
import { solve } from '../src/engine/solver';
import type { Level } from '../src/engine/types';
import { BANDS, LEVELS_PER_BAND, levelId } from '../src/progression/bands';

export const CAMPAIGN_SEED = 20261114;

export function generateCampaign(seed = CAMPAIGN_SEED): Level[] {
  const rng = mulberry32(seed);
  const out: Level[] = [];
  for (const band of BANDS) {
    const seen = new Set<string>();
    for (let i = 0; i < LEVELS_PER_BAND; i++) {
      out.push(generate(band.config, rng, seen, { id: levelId(band.id, i), band: band.id }));
    }
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const t0 = performance.now();
  const levels = generateCampaign();
  for (const l of levels) {
    const { solutions } = solve(l);
    if (solutions.length !== 1 || solutions[0].join() !== l.solution.join()) throw new Error(`verify failed: ${l.id}`);
  }
  for (const b of BANDS) {
    const ns = levels.filter((l) => l.band === b.id).map((l) => l.nodes).sort((a, c) => a - c);
    console.log(`${b.id}: nodes median ${ns[20]}, max ${ns[ns.length - 1]}`);
  }
  // One level per line: small diffs, readable file.
  const json = '[\n' + levels.map((l) => JSON.stringify(l)).join(',\n') + '\n]\n';
  const target = fileURLToPath(new URL('../src/data/levels.json', import.meta.url));
  writeFileSync(target, json);
  console.log(`${levels.length} levels in ${Math.round(performance.now() - t0)} ms → ${target}`);
}
