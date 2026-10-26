import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  RunDetailSchema,
  StartedRunResponseSchema,
  StepRunRecordSchema,
  WorkflowDetailSchema,
  type StepRunRecord,
} from '@easter-workflow-builder/protocol';
import { isUnknownArray } from '@easter-workflow-builder/typeguards';
import type { ProviderId } from '@easter-workflow-builder/provider-capability';
import { buildProbeGraph } from './build-probe-graph.ts';
import { findFreePort } from './find-free-port.ts';
import { openEventStream } from './open-event-stream.ts';
import { parseOrThrow } from './parse-or-throw.ts';
import type { ProbeSummary } from './probe-summary.ts';
import { requestJson, type JsonResponse } from './request-json.ts';
import { startProbeServer, type ProbeServerCommand } from './start-probe-server.ts';
import { summarizeRun } from './summarize-run.ts';
import { waitForRunFinished } from './wait-for-run-finished.ts';

export interface ProbeOptions {
  readonly providerId: ProviderId;
  /**
  Opcionális modell azonosító a lépéshez (alapértelmezés: `build-probe-graph.ts`).
  */
  readonly modelId?: string;
  /**
  A gyermek szerver indítása (`node apps/server/src/main.ts`), a tesztben a hamis ágenses szerver.
  */
  readonly serverCommand: ProbeServerCommand;
  /**
  A próba folyamat környezete; a gyermek szerver ezt kapja, két érték felülírásával.
  */
  readonly environment: NodeJS.ProcessEnv;
  /**
  A titkok értékei: a hibaüzenetekben `REDACTED`-re cserélődnek.
  */
  readonly secretValues: readonly string[];
  readonly signal: AbortSignal;
}

function expectOk(response: JsonResponse, what: string): unknown {
  if (response.status !== 200) {
    throw new Error(`A(z) ${what} nem 200 választ adott (${String(response.status)}) ${JSON.stringify(response.body)}`);
  }
  return response.body;
}

function parseStepRuns(body: unknown): readonly StepRunRecord[] {
  if (!isUnknownArray(body)) {
    throw new Error('A lépés futások válasza nem tömb.');
  }
  return body.map((item) => parseOrThrow(StepRunRecordSchema.safeParse(item), 'lépés futás'));
}

/**
 * A valódi provider próba lépései (SPEC-012 5.1): saját szerver ideiglenes
 * adatbázissal és napló útvonallal, szabad porton; beállítás, workflow, gráf;
 * stream feliratkozás, futás indítás, várakozás a `run_finished` keretre;
 * összegzés. A `finally` ág mindig leállítja a szervert és törli az
 * ideiglenes könyvtárat (a megszakítás is ide ér). Az időkorlát hiánya
 * szándékos (O-15).
 */
export async function runProbe(options: ProbeOptions): Promise<ProbeSummary> {
  const { providerId, signal } = options;
  const workDirectory = mkdtempSync(path.join(tmpdir(), 'easter-probe-'));
  let stopServer: (() => Promise<void>) | undefined;
  try {
    const port = await findFreePort();
    const server = await startProbeServer(
      options.serverCommand,
      {
        ...options.environment,
        EASTER_SERVER_PORT: String(port),
        EASTER_DB_FILE: path.join(workDirectory, 'proba.sqlite'),
        EASTER_LOG_DIRECTORY: path.join(workDirectory, 'logs', 'server'),
      },
      port,
      options.secretValues,
      signal,
    );
    stopServer = () => server.stop();
    const { baseUrl } = server;
    const call = async (method: string, routePath: string, body?: unknown): Promise<unknown> => {
      const response = await requestJson(baseUrl, method, routePath, signal, body);
      return expectOk(response, `${method} ${routePath}`);
    };

    await call('PUT', '/api/settings', { defaultProviderId: providerId });
    // eslint-disable-next-line unicorn/no-null -- a leírás és a workflow providerId mező valódi NULL érték (SPEC-005 4.2 A)
    const workflowCreation = { name: 'valodi-provider-proba', description: null, providerId: null };
    const created = await call('POST', '/api/workflows', workflowCreation);
    const workflowId = parseOrThrow(WorkflowDetailSchema.safeParse(created), 'workflow válasz').id;
    await call('PUT', `/api/workflows/${workflowId}/graph`, buildProbeGraph(providerId, options.modelId));

    const stream = await openEventStream(baseUrl, signal);
    try {
      const started = await call('POST', `/api/workflows/${workflowId}/runs`, { input: {} });
      const runId = parseOrThrow(StartedRunResponseSchema.safeParse(started), 'futás indítás válasz').runId;
      await call('PUT', `/api/streams/${stream.streamId}/subscriptions`, {
        runs: [{ runId, fromEventId: 0, replayLimit: 500 }],
      });
      const finished = await waitForRunFinished(stream.frames, runId);

      const runBody = await call('GET', `/api/runs/${runId}`);
      const run = parseOrThrow(RunDetailSchema.safeParse(runBody), 'futás válasz');
      const stepRuns = parseStepRuns(await call('GET', `/api/runs/${runId}/steps`));
      return summarizeRun(providerId, run, stepRuns, finished.resultTextLength);
    } finally {
      await stream.close();
    }
  } finally {
    await stopServer?.();
    rmSync(workDirectory, { recursive: true, force: true });
  }
}
