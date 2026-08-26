/**
 * M-12: nem-Messages végpontok -- Q10.
 * Nem egy szokásos `query()` mérés: az SDK indulási fázisát és a
 * `supportedModels()` metódust célozza, ezért nem az executeQuery közös
 * futtatóján megy keresztül.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import type { CaseRunOutcome, MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, DEFAULT_PROMPT } from '../harness/runner.ts';

export const M12: MeasurementCase = {
  id: 'M-12',
  title: 'Nem-Messages végpontok',
  question: 'Q10',
  async run(context) {
    const caseDirectory = path.join(context.outDir, 'M-12');
    mkdirSync(caseDirectory, { recursive: true });

    const stream = query({ prompt: DEFAULT_PROMPT, options: buildBaseOptions(context) });
    let harnessError: string | undefined;
    let initializationResult: unknown;
    let supportedModels: unknown;
    try {
      initializationResult = await stream.initializationResult();
      supportedModels = await stream.supportedModels();
    } catch (error) {
      harnessError = error instanceof Error ? error.message : String(error);
    } finally {
      stream.close();
    }

    const summary = { initializationResult, supportedModels, harnessError };
    writeFileSync(path.join(caseDirectory, 'a.lifecycle.json'), JSON.stringify(summary, undefined, 2), 'utf8');

    const outcome: CaseRunOutcome = {
      runId: 'a',
      ok: harnessError === undefined,
      note:
        harnessError === undefined
          ? 'initializationResult() + supportedModels() rögzítve az a.lifecycle.json-ba'
          : `harness hiba: ${harnessError}`,
    };
    return [outcome];
  },
};
