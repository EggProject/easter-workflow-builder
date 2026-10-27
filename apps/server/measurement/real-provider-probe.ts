// A VALÓDI PROVIDER PRÓBA belépési pontja (SPEC-012 5., PLAN-013 T-013-9).
//
// MIÉRT VAN A REPÓBAN: a szabálykönyv 12. szekciója szerint minden bizonyíték
// előállító eszköz a repóba tartozik, verziókövetve.
//
// NEM KAPU, NEM CI: valódi provider hívást tesz, a CI nem kap kulcsot. A
// futtatásához a user kifejezett, az adott futásra szóló engedélye kell
// (SPEC-012 5.3). A `bun run test` kapu csak a hamis ágenses szerver elleni
// `run-probe.spec.ts` tesztet futtatja, valódi hívás nélkül.
//
// FUTTATÁS a repó gyökeréből (a `.env` fájl betöltésével):
//
//   bun run probe:real-provider -- minimax
//   bun run probe:real-provider -- claude-subscription [modelId]
//
// A `modelId` opcionális: alapból `minimax` mellett `MiniMax-M3.1-Flash`,
// `claude-subscription` mellett `claude-haiku-4-5` (SPEC-013 6.).
//
// A kimenet csak összegzés; a titkok értéke `REDACTED`. A megszakítás
// (`Ctrl-C`) a gyermek szervert is leállítja és az ideiglenes könyvtárat
// törli. Időkorlát nincs (O-15).
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { isProviderId } from '@easter-workflow-builder/provider-capability';
import { collectSecretEnvironmentValues } from '../src/startup-sequence/collect-secret-environment-values.ts';
import { maskSecrets } from './mask-secrets.ts';
import { runProbe } from './run-probe.ts';

const providerArgument = process.argv[2];
if (isProviderId(providerArgument)) {
  const secretValues = collectSecretEnvironmentValues(process.env);
  const controller = new AbortController();
  process.on('SIGINT', () => {
    controller.abort();
  });
  process.on('SIGTERM', () => {
    controller.abort();
  });
  try {
    const summary = await runProbe({
      providerId: providerArgument,
      ...(process.argv[3] !== undefined && { modelId: process.argv[3] }),
      serverCommand: {
        executable: process.execPath,
        args: [fileURLToPath(new URL('../src/main.ts', import.meta.url))],
      },
      environment: process.env,
      secretValues,
      signal: controller.signal,
    });
    process.stdout.write(`${maskSecrets(JSON.stringify(summary, undefined, 2), secretValues)}\n`);
  } catch (error) {
    const description = error instanceof Error ? error.message : String(error);
    process.stderr.write(`A próba megszakadt: ${maskSecrets(description, secretValues)}\n`);
    process.exitCode = 1;
  }
} else {
  process.stderr.write('Használat: bun run probe:real-provider -- <minimax|claude-subscription> [modelId]\n');
  process.exitCode = 2;
}
