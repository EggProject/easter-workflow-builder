/**
 * A mérési harness CLI belépési pontja. Parancssori argumentumból veszi, mely
 * mérési eset(ek) fusson(anak) le, vagy `--all` esetén az összeset.
 *
 * Használat:
 *   node src/probe.ts M-01
 *   node src/probe.ts M-01 M-02 M-03
 *   node src/probe.ts --all
 *
 * Előfeltétel: a proxy fusson (`bun run proxy`), és a MINIMAX_API_KEY elérhető
 * legyen (process.env vagy a repo gyökér .env fájlja).
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CASE_IDS, CASE_REGISTRY } from './cases/index.ts';
import { loadMinimaxApiKey } from './harness/env.ts';
import { readInstalledSdkVersion } from './harness/sdk-constants.ts';
import type { CaseContext } from './harness/types.ts';

const moduleDir = dirname(fileURLToPath(import.meta.url));

function resolveRequestedIds(argv: readonly string[]): readonly string[] {
  if (argv.length === 0 || argv.includes('--all')) {
    return CASE_IDS;
  }
  return argv;
}

async function main(): Promise<void> {
  const requestedIds = resolveRequestedIds(process.argv.slice(2));
  const unknownIds = requestedIds.filter((id) => !(id in CASE_REGISTRY));
  if (unknownIds.length > 0) {
    console.error(`Ismeretlen eset azonosító(k): ${unknownIds.join(', ')}`);
    console.error(`Ismert esetek: ${CASE_IDS.join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const proxyPort = Number(process.env.WIRE_PROBE_PORT ?? 8787);
  const ctx: CaseContext = {
    proxyPort,
    proxyBaseUrl: `http://127.0.0.1:${String(proxyPort)}/anthropic`,
    minimaxApiKey: loadMinimaxApiKey(),
    outDir: process.env.WIRE_PROBE_OUT_DIR ?? join(moduleDir, '..', 'artifacts', 'harness'),
    sdkVersion: readInstalledSdkVersion(),
  };

  for (const id of requestedIds) {
    const measurementCase = CASE_REGISTRY[id];
    if (measurementCase === undefined) {
      continue;
    }
    console.log(`--- ${id}: ${measurementCase.title} ---`);
    try {
      const outcomes = await measurementCase.run(ctx);
      for (const outcome of outcomes) {
        console.log(`  [${outcome.ok ? 'ok' : 'HIBA'}] ${outcome.runId}: ${outcome.note}`);
      }
    } catch (err) {
      // Egy eset harness-szintű kivétele (pl. hálózati hiba) nem állítja meg
      // a többi esetet. A 400/429 válasz nem itt jelenik meg -- az mérési
      // eredmény, amit az executeQuery a result üzenetből rögzít.
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  [HIBA] ${id} futtatása megszakadt: ${message}`);
    }
  }
}

void main();
