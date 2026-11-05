/* eslint-disable unicorn/no-null -- a port `cwd` és korlát mezőinek üres értéke a tárolt `null` (SPEC-014 5.3), az `exit` esemény hiányzó kódja és jelzése `null` (Node `child_process` doksi) */
import { EventEmitter, once } from 'node:events';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { RunContext, ScriptRunRequest } from '@easter-workflow-builder/engine';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createChildProcessScriptRun } from './create-child-process-script-run.ts';
import type { SandboxRunRequest } from './sandbox-run-request.ts';
import type { ScriptChildProcess } from './script-child-process.ts';
import { spawnScriptChild } from './spawn-script-child.ts';

const CONTEXT: RunContext = {
  input: { n: 2 },
  steps: {},
  item: undefined,
  itemIndex: undefined,
  iteration: undefined,
  joinInputs: undefined,
  error: undefined,
};

function request(source: string, overrides: Partial<ScriptRunRequest> = {}): ScriptRunRequest {
  return {
    source,
    runContext: CONTEXT,
    timeoutMs: 5000,
    cwd: null,
    memoryLimitMb: 64,
    fetchResponseLimitMb: null,
    fileReadLimitMb: null,
    signal: new AbortController().signal,
    ...overrides,
  };
}

// Hamis szkript folyamat: a teszt maga váltja ki az eseményeket. A Node `ChildProcess` maga is
// `EventEmitter`, és a futtató annak az `on`/`once` felületét használja, ezért a hamis folyamat is az.
// eslint-disable-next-line unicorn/prefer-event-target -- a `ChildProcess` eseménykezelő felülete `EventEmitter`, `EventTarget` nem helyettesíti
class FakeChild extends EventEmitter implements ScriptChildProcess {
  readonly sent: SandboxRunRequest[] = [];
  readonly kills: string[] = [];

  send(message: SandboxRunRequest): boolean {
    this.sent.push(message);
    return true;
  }

  kill(signal: 'SIGKILL'): boolean {
    this.kills.push(signal);
    return true;
  }
}

function withFake(): { readonly child: FakeChild; readonly run: ReturnType<typeof createChildProcessScriptRun> } {
  const child = new FakeChild();
  return { child, run: createChildProcessScriptRun(() => child) };
}

describe('createChildProcessScriptRun, hamis folyamattal', () => {
  it('a kérést a leképezett alakban küldi, a folyamat válasza az eredmény, utána SIGKILL', async () => {
    const { child, run } = withFake();
    const running = run(request('return 1;'));
    child.emit('message', { kind: 'succeeded', output: 1 });
    await expect(running).resolves.toStrictEqual({ kind: 'succeeded', output: 1 });
    expect(child.sent).toHaveLength(1);
    expect(child.sent[0]).toMatchObject({ source: 'return 1;', contextJson: '{"input":{"n":2},"steps":{}}' });
    expect(child.kills).toStrictEqual(['SIGKILL']);
  });

  it('a nem várt alakú válasz script_evaluation_failed', async () => {
    const { child, run } = withFake();
    const running = run(request('return 1;'));
    child.emit('message', { kind: 'aborted' });
    await expect(running).resolves.toStrictEqual({
      kind: 'failed',
      errorKind: 'script_evaluation_failed',
      message: 'a szkript folyamata nem a várt alakú választ adta',
    });
  });

  it.each([
    [3, null, 'kilépési kód: 3'],
    [null, 'SIGSEGV', 'jelzés: SIGSEGV'],
  ])('a válasz nélküli kilépés (%s, %s) script_evaluation_failed a okkal', async (code, signal, cause) => {
    const { child, run } = withFake();
    const running = run(request('return 1;'));
    child.emit('exit', code, signal);
    await expect(running).resolves.toStrictEqual({
      kind: 'failed',
      errorKind: 'script_evaluation_failed',
      message: `a szkript folyamata válasz nélkül leállt (${cause})`,
    });
  });

  it('az indítás vagy a csatorna hibája script_evaluation_failed, a döntés utáni események hatástalanok', async () => {
    const { child, run } = withFake();
    const running = run(request('return 1;'));
    child.emit('error', new RangeError('x'));
    child.emit('error', new TypeError('y'));
    child.emit('message', { kind: 'succeeded', output: 1 });
    child.emit('exit', 0, null);
    await expect(running).resolves.toStrictEqual({
      kind: 'failed',
      errorKind: 'script_evaluation_failed',
      message: 'a szkript folyamata nem indult el vagy a csatornája hibát adott (RangeError)',
    });
    expect(child.kills).toStrictEqual(['SIGKILL']);
  });

  it('a már megszakított jel mellett folyamat sem indul', async () => {
    const controller = new AbortController();
    controller.abort();
    let spawned = 0;
    const run = createChildProcessScriptRun(() => {
      spawned += 1;
      return new FakeChild();
    });
    await expect(run(request('return 1;', { signal: controller.signal }))).resolves.toStrictEqual({ kind: 'aborted' });
    expect(spawned).toBe(0);
  });

  it('a jel a futás közben aborted, és a folyamat SIGKILL-t kap', async () => {
    const { child, run } = withFake();
    const controller = new AbortController();
    const running = run(request('return 1;', { signal: controller.signal, timeoutMs: 60_000 }));
    controller.abort();
    await expect(running).resolves.toStrictEqual({ kind: 'aborted' });
    expect(child.kills).toStrictEqual(['SIGKILL']);
  });

  it('a határidőn script_timed_out, és a folyamat SIGKILL-t kap', async () => {
    const { child, run } = withFake();
    await expect(run(request('return 1;', { timeoutMs: 30 }))).resolves.toStrictEqual({
      kind: 'failed',
      errorKind: 'script_timed_out',
      message: 'a szkript nem fejeződött be 30 ms alatt',
    });
    expect(child.kills).toStrictEqual(['SIGKILL']);
  });
});

// Valódi folyamat: a `spawnScriptChild` a `script-child-entry.ts` belépési pontot indítja
// (SPEC-017 4.1). Valódi külső hívás nincs, a hálózat helyi teszt szerveren megy.
describe('createChildProcessScriptRun, valódi szkript folyamattal', () => {
  const run = createChildProcessScriptRun(spawnScriptChild);
  const hanging: IncomingMessage[] = [];
  const target = { origin: '' };
  let server: Server;

  beforeAll(async () => {
    server = createServer((incoming) => {
      hanging.push(incoming);
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address: AddressInfo | string | null = server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('a teszt szerver nem TCP címen figyel');
    }
    target.origin = `http://127.0.0.1:${String(address.port)}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    server.close();
    await once(server, 'close');
  });

  it('a szkript a külön folyamatban lefut, a futás kontextust látja', async () => {
    await expect(run(request('return input.n * 21;'))).resolves.toStrictEqual({ kind: 'succeeded', output: 42 });
  });

  it('REGRESSZIÓ (SPEC-014 7.2 T-5): a kézi leállítás CPU kötött ciklus alatt azonnal hat, nem a határidőn', async () => {
    // A 60 000 ms-os határidő a Vitest 5000 ms-os teszt korlátján túl van: ha a jel csak a határidőn
    // érne célba (a régi, a szerver szálán futó QuickJS viselkedése), a teszt időtúllépéssel bukna.
    const controller = new AbortController();
    const running = run(request('while (true) {}', { signal: controller.signal, timeoutMs: 60_000 }));
    setTimeout(() => {
      controller.abort();
    }, 500);
    await expect(running).resolves.toStrictEqual({ kind: 'aborted' });
  });

  it('a CPU kötött ciklus a határidőn script_timed_out', async () => {
    await expect(run(request('while (true) {}', { timeoutMs: 1000 }))).resolves.toStrictEqual({
      kind: 'failed',
      errorKind: 'script_timed_out',
      message: 'a szkript nem fejeződött be 1000 ms alatt',
    });
  });

  it('a gazda hálózati kérésre várakozó szkript leállításakor a kérés kapcsolata is megszakad', async () => {
    const controller = new AbortController();
    const running = run(request(`await fetch("${target.origin}/hang"); return 1;`, { signal: controller.signal }));
    const waitForRequest = async (): Promise<IncomingMessage> => {
      while (hanging.length === 0) {
        await once(server, 'request');
      }
      const first = hanging.shift();
      if (first === undefined) {
        throw new Error('nincs függő kérés');
      }
      return first;
    };
    const incoming = await waitForRequest();
    const closed = once(incoming.socket, 'close');
    controller.abort();
    await expect(running).resolves.toStrictEqual({ kind: 'aborted' });
    await closed;
  });

  it('a kívülről megölt szkript folyamat a lépés hibája, és utána egy új lépés hibátlanul fut', async () => {
    const victim: { child: ScriptChildProcess | undefined } = { child: undefined };
    const crashing = createChildProcessScriptRun(() => {
      const child = spawnScriptChild();
      victim.child = child;
      return child;
    });
    const running = crashing(request('while (true) {}', { timeoutMs: 60_000 }));
    setTimeout(() => {
      victim.child?.kill('SIGKILL');
    }, 500);
    await expect(running).resolves.toStrictEqual({
      kind: 'failed',
      errorKind: 'script_evaluation_failed',
      message: 'a szkript folyamata válasz nélkül leállt (jelzés: SIGKILL)',
    });
    await expect(run(request('return 1;'))).resolves.toStrictEqual({ kind: 'succeeded', output: 1 });
  });

  it('a sandbox memória túllépése a külön folyamatban is elkapható', async () => {
    const source =
      'const a = []; try { while (true) { a.push(new Array(1e5).fill(1)); } } catch (e) { a.length = 0; return e.message; }';
    await expect(run(request(source, { memoryLimitMb: 16 }))).resolves.toStrictEqual({
      kind: 'succeeded',
      output: 'out of memory',
    });
  });
});
