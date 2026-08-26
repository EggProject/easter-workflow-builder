/**
 * M-35: listedByModelsEndpoint -- közvetlen HTTP hívás (Node natív `fetch`,
 * nem az SDK) a MiniMax `GET /v1/models` végpontjára, a proxyn keresztül,
 * hogy a nyers tranzakció automatikusan, maszkolva rögzüljön. Az SDK a
 * teljes M-01 ... M-25 mérés alatt egyszer sem hívta meg ezt az útvonalat
 * (M-12), ezért ezt is csak a kliens megkerülésével lehet előállítani.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CaseRunOutcome, MeasurementCase } from '../harness/types.ts';

export const M35: MeasurementCase = {
  id: 'M-35',
  title: 'listedByModelsEndpoint közvetlen HTTP hívással',
  question: 'listedByModelsEndpoint (nyitva maradt capability mező)',
  async run(ctx) {
    const caseDir = join(ctx.outDir, 'M-35');
    mkdirSync(caseDir, { recursive: true });

    const response = await fetch(`${ctx.proxyBaseUrl}/v1/models`, {
      method: 'GET',
      headers: {
        'x-api-key': ctx.minimaxApiKey,
        'anthropic-version': '2023-06-01',
      },
    });
    const bodyText = await response.text();
    writeFileSync(join(caseDir, 'a-get-models.json'), JSON.stringify({ status: response.status, bodyText }, null, 2), 'utf8');

    const outcomes: CaseRunOutcome[] = [{ runId: 'a-get-models', ok: true, note: `HTTP ${String(response.status)}` }];
    return outcomes;
  },
};
