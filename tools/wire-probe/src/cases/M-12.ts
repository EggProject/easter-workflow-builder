/**
 * M-12: nem-Messages végpontok -- Q10.
 * Nem egy szokásos `query()` mérés: az SDK indulási fázisát és a
 * `supportedModels()` metódust célozza, ezért nem az executeQuery közös
 * futtatóján megy keresztül.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { CaseRunOutcome, MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, DEFAULT_PROMPT } from '../harness/runner.ts';

export const M12: MeasurementCase = {
  id: 'M-12',
  title: 'Nem-Messages végpontok',
  question: 'Q10',
  async run(ctx) {
    const caseDir = join(ctx.outDir, 'M-12');
    mkdirSync(caseDir, { recursive: true });

    const stream = query({ prompt: DEFAULT_PROMPT, options: buildBaseOptions(ctx) });
    let harnessError: string | null = null;
    let initializationResult: unknown = null;
    let supportedModels: unknown = null;
    try {
      initializationResult = await stream.initializationResult();
      supportedModels = await stream.supportedModels();
    } catch (err) {
      harnessError = err instanceof Error ? err.message : String(err);
    } finally {
      stream.close();
    }

    const summary = { initializationResult, supportedModels, harnessError };
    writeFileSync(join(caseDir, 'a.lifecycle.json'), JSON.stringify(summary, null, 2), 'utf8');

    const outcome: CaseRunOutcome = {
      runId: 'a',
      ok: harnessError === null,
      note:
        harnessError !== null
          ? `harness hiba: ${harnessError}`
          : 'initializationResult() + supportedModels() rögzítve az a.lifecycle.json-ba',
    };
    return [outcome];
  },
};
