/* eslint-disable unicorn/no-null -- a port `cwd` és korlát mezőinek üres értéke a tárolt `null` (SPEC-014 5.3) */
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { getHeapStatistics } from 'node:v8';
import type { ScriptRunRequest, ScriptRunResult } from '@easter-workflow-builder/engine';
import { isNumber } from '@easter-workflow-builder/typeguards';
import { buildSandboxRunRequest } from '../src/script-runner/build-sandbox-run-request.ts';
import { createChildProcessScriptRun } from '../src/script-runner/create-child-process-script-run.ts';
import { runScript } from '../src/script-runner/run-script.ts';
import type { ScriptChildProcess } from '../src/script-runner/script-child-process.ts';
import { spawnScriptChild } from '../src/script-runner/spawn-script-child.ts';

/**
 * A SPEC-017 mérései (research `2026-11-05-szkript-kulon-folyamat.md` 4.
 * szekció): `node apps/server/measurement/script-process-measurement.ts`.
 * Képet nem ír, csak `MEASUREMENT <json>` sorokat; nem kapu, mert időt mér.
 *
 * - M-1 indítási költség: ugyanaz a szkript a szerver folyamatában és külön
 *   folyamatban, lépésenként.
 * - M-2 a kézi leállítás azonnalisága CPU kötött ciklus alatt: a jel és az
 *   `aborted` eredmény közötti idő.
 * - M-3 a memória: a sandbox memória korlátja a külön folyamatban, és a V8
 *   heap korlát ezen a gépen.
 * - M-4 a szerver túlélése: a szkript folyamat kívülről `SIGSEGV`-t kap, a
 *   lépés hibát ad, a következő lépés lefut.
 * - M-5 a szkript folyamat környezete (Linux `/proc/<pid>/environ`).
 * - M-6 árva folyamat: a CPU kötött szkript szülője `SIGKILL`-t kap, mennyi idő
 *   alatt szűnik meg a szkript folyamat.
 * - M-7 memória lépésenként: tíz egyszerre várakozó szkript folyamat RSS-e
 *   (Linux `/proc/<pid>/status` `VmRSS`).
 */

const REPEATS = 10;

function request(source: string, overrides: Partial<ScriptRunRequest> = {}): ScriptRunRequest {
  return {
    source,
    runContext: {
      input: {},
      steps: {},
      item: undefined,
      itemIndex: undefined,
      iteration: undefined,
      joinInputs: undefined,
      error: undefined,
    },
    timeoutMs: 60_000,
    cwd: null,
    memoryLimitMb: 64,
    fetchResponseLimitMb: null,
    fileReadLimitMb: null,
    signal: new AbortController().signal,
    ...overrides,
  };
}

function report(id: string, value: unknown): void {
  console.log(`MEASUREMENT ${JSON.stringify({ id, value })}`);
}

function summary(samples: readonly number[]): { min: number; median: number; max: number } {
  const sorted = [...samples].toSorted((left, right) => left - right);
  const round = (value: number | undefined): number => Math.round((value ?? NaN) * 10) / 10;
  return { min: round(sorted[0]), median: round(sorted[Math.floor(sorted.length / 2)]), max: round(sorted.at(-1)) };
}

async function timed(run: () => Promise<ScriptRunResult>): Promise<{ ms: number; result: ScriptRunResult }> {
  const started = performance.now();
  const result = await run();
  return { ms: performance.now() - started, result };
}

const childRun = createChildProcessScriptRun(spawnScriptChild);

async function measureStartupCost(): Promise<void> {
  const inProcess: number[] = [];
  const separate: number[] = [];
  for (let index = 0; index < REPEATS; index += 1) {
    const local = await timed(() => runScript(buildSandboxRunRequest(request('return 1;'), Date.now()), () => false));
    inProcess.push(local.ms);
    const child = await timed(() => childRun(request('return 1;')));
    separate.push(child.ms);
  }
  report('M-1', { repeats: REPEATS, inProcessMs: summary(inProcess), childProcessMs: summary(separate) });
}

async function measureAbortLatency(): Promise<void> {
  const latencies: number[] = [];
  const exits: number[] = [];
  const kinds: string[] = [];
  for (let index = 0; index < REPEATS; index += 1) {
    const controller = new AbortController();
    const exited = Promise.withResolvers<number>();
    const watched = createChildProcessScriptRun(() => {
      const child = spawnScriptChild();
      child.once('exit', () => {
        exited.resolve(performance.now());
      });
      return child;
    });
    const running = watched(request('while (true) {}', { signal: controller.signal }));
    await new Promise((resolve) => setTimeout(resolve, 300));
    const abortedAt = performance.now();
    controller.abort();
    const result = await running;
    latencies.push(performance.now() - abortedAt);
    exits.push((await exited.promise) - abortedAt);
    kinds.push(result.kind);
  }
  report('M-2', {
    repeats: REPEATS,
    timeoutMs: 60_000,
    abortToResultMs: summary(latencies),
    abortToProcessExitMs: summary(exits),
    kinds: [...new Set(kinds)],
  });
}

async function measureMemory(): Promise<void> {
  const catchable = await childRun(
    request(
      'const a = []; try { for (;;) { a.push(new Array(1e5).fill(1)); } } catch (e) { a.length = 0; return e.message; }',
      {
        memoryLimitMb: 16,
      },
    ),
  );
  report('M-3', {
    sandbox16MbResult: catchable,
    defaultHeapSizeLimitMb: getHeapStatistics().heap_size_limit / 2 ** 20,
  });
}

function pidOf(child: ScriptChildProcess): number {
  const pid: unknown = Reflect.get(child, 'pid');
  if (!isNumber(pid)) {
    throw new Error('a szkript folyamatnak nincs pid-je');
  }
  return pid;
}

async function measureCrashSurvival(): Promise<void> {
  const victim: { pid: number | undefined } = { pid: undefined };
  const crashing = createChildProcessScriptRun(() => {
    const child = spawnScriptChild();
    victim.pid = pidOf(child);
    return child;
  });
  const running = crashing(request('while (true) {}'));
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (victim.pid !== undefined) {
    process.kill(victim.pid, 'SIGSEGV');
  }
  const crashed = await running;
  const next = await childRun(request('return "a szerver él";'));
  report('M-4', { crashed, next, serverPid: process.pid });
}

function measureEnvironment(): void {
  const child = fork(new URL('../src/script-runner/script-child-entry.ts', import.meta.url), [], {
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  const childDefault = readFileSync(`/proc/${String(pidOf(child))}/environ`, 'utf8')
    .split('\0')
    .filter(Boolean).length;
  child.kill('SIGKILL');
  const separate = spawnScriptChild();
  const names = readFileSync(`/proc/${String(pidOf(separate))}/environ`, 'utf8')
    .split('\0')
    .filter(Boolean)
    .map((entry) => entry.split('=', 1)[0]);
  separate.kill('SIGKILL');
  report('M-5', {
    serverNameCount: Object.keys(process.env).length,
    forkDefaultNameCount: childDefault,
    scriptChildNames: names,
  });
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function runOrphanParent(): Promise<void> {
  const parentRun = createChildProcessScriptRun(() => {
    const child = spawnScriptChild();
    if (process.send !== undefined) {
      process.send(pidOf(child));
    }
    return child;
  });
  await parentRun(request('while (true) {}'));
}

async function measureOrphan(): Promise<void> {
  const parent = fork(new URL(import.meta.url), ['orphan-parent'], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  const messages: unknown[] = await once(parent, 'message');
  const [grandchild] = messages;
  if (!isNumber(grandchild)) {
    throw new Error('a köztes folyamat nem küldött pid-et');
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  const killedAt = performance.now();
  parent.kill('SIGKILL');
  while (isAlive(grandchild) && performance.now() - killedAt < 60_000) {
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  report('M-6', {
    timeoutMs: 60_000,
    parentKillToScriptExitMs: Math.round(performance.now() - killedAt),
    alive: isAlive(grandchild),
  });
}

async function measureResidentMemory(): Promise<void> {
  const count = 10;
  const pids: number[] = [];
  const controller = new AbortController();
  const collecting = createChildProcessScriptRun(() => {
    const child = spawnScriptChild();
    pids.push(pidOf(child));
    return child;
  });
  const runs = Array.from({ length: count }, () =>
    collecting(request('await new Promise(() => {}); return 1;', { signal: controller.signal })),
  );
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const rssMb = pids.map((pid) => {
    const line = readFileSync(`/proc/${String(pid)}/status`, 'utf8')
      .split('\n')
      .find((entry) => entry.startsWith('VmRSS:'));
    return Number(line?.replaceAll(/\D/g, '') ?? 0) / 1024;
  });
  controller.abort();
  await Promise.all(runs);
  report('M-7', {
    count,
    rssMbPerProcess: summary(rssMb),
    totalMb: Math.round(rssMb.reduce((sum, value) => sum + value, 0)),
  });
}

if (process.argv[2] === 'orphan-parent') {
  await runOrphanParent();
} else {
  await measureStartupCost();
  await measureAbortLatency();
  await measureMemory();
  await measureCrashSurvival();
  measureEnvironment();
  await measureOrphan();
  await measureResidentMemory();
}
