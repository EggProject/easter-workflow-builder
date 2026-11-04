/* eslint-disable unicorn/no-null -- a port `timeoutMs`, `cwd` és `memoryLimitMb` mezőjének üres értéke a tárolt `null` (SPEC-014 5.3), és a szkript `null` kimenete is JSON érték */
import type { RunContext, ScriptRunRequest, ScriptRunResult } from '@easter-workflow-builder/engine';
import { describe, expect, it } from 'vitest';
import { runScript } from './run-script.ts';

// A friss kontextus 61 globális neve (research `2026-11-04-szkript-csomopont.md` Q-8).
const QUICKJS_GLOBAL_NAMES = [
  'AggregateError',
  'Array',
  'ArrayBuffer',
  'BigInt',
  'BigInt64Array',
  'BigUint64Array',
  'Boolean',
  'DataView',
  'Date',
  'Error',
  'EvalError',
  'FinalizationRegistry',
  'Float16Array',
  'Float32Array',
  'Float64Array',
  'Function',
  'Infinity',
  'Int16Array',
  'Int32Array',
  'Int8Array',
  'InternalError',
  'Iterator',
  'JSON',
  'Map',
  'Math',
  'NaN',
  'Number',
  'Object',
  'Promise',
  'Proxy',
  'RangeError',
  'ReferenceError',
  'Reflect',
  'RegExp',
  'Set',
  'SharedArrayBuffer',
  'String',
  'Symbol',
  'SyntaxError',
  'TypeError',
  'URIError',
  'Uint16Array',
  'Uint32Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'WeakMap',
  'WeakRef',
  'WeakSet',
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
  'escape',
  'eval',
  'globalThis',
  'isFinite',
  'isNaN',
  'parseFloat',
  'parseInt',
  'undefined',
  'unescape',
] as const;

const MINIMAL_CONTEXT: RunContext = {
  input: { name: 'teszt' },
  steps: { elozo: { ok: true } },
  item: undefined,
  itemIndex: undefined,
  iteration: undefined,
  joinInputs: undefined,
  error: undefined,
};

const FULL_CONTEXT: RunContext = {
  input: { name: 'teszt' },
  steps: { elozo: { ok: true } },
  item: 'elem',
  itemIndex: 2,
  iteration: 3,
  joinInputs: [{ a: 1 }, { b: 2 }],
  error: { kind: 'agent_failed', message: 'hiba' },
};

function request(source: string, overrides: Partial<ScriptRunRequest> = {}): ScriptRunRequest {
  return {
    source,
    runContext: MINIMAL_CONTEXT,
    timeoutMs: 5000,
    cwd: null,
    memoryLimitMb: 64,
    signal: new AbortController().signal,
    ...overrides,
  };
}

// A sikeres futás kimenete; minden más eredmény a teszt hibája.
function outputOf(result: ScriptRunResult): unknown {
  if (result.kind !== 'succeeded') {
    throw new Error(`a szkript nem futott le sikeresen: ${JSON.stringify(result)}`);
  }
  return result.output;
}

describe('runScript', () => {
  describe('sikeres futás', () => {
    it('objektumot, tömböt, számot és null értéket ad vissza JSON értékként', async () => {
      await expect(runScript(request('return { a: 1, b: [true, "x"] };'))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: { a: 1, b: [true, 'x'] },
      });
      await expect(runScript(request('return [1, 2, 3];'))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: [1, 2, 3],
      });
      await expect(runScript(request('return 42.5;'))).resolves.toStrictEqual({ kind: 'succeeded', output: 42.5 });
      await expect(runScript(request('return null;'))).resolves.toStrictEqual({ kind: 'succeeded', output: null });
    });

    it('a törzsben await használható', async () => {
      await expect(
        runScript(request('const x = await Promise.resolve(input.name); return x + "!";')),
      ).resolves.toStrictEqual({
        kind: 'succeeded',
        output: 'teszt!',
      });
    });

    it('a null időkorláttal és null memória korláttal is fut (az alapértékek)', async () => {
      await expect(runScript(request('return 1;', { timeoutMs: null, memoryLimitMb: null }))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: 1,
      });
    });
  });

  describe('a futás kontextus nevei', () => {
    it('a hét név JSON értékként látszik', async () => {
      const result = await runScript(
        request('return { input, steps, item, itemIndex, iteration, joinInputs, error };', {
          runContext: FULL_CONTEXT,
        }),
      );
      expect(result).toStrictEqual({
        kind: 'succeeded',
        output: {
          input: { name: 'teszt' },
          steps: { elozo: { ok: true } },
          item: 'elem',
          itemIndex: 2,
          iteration: 3,
          joinInputs: [{ a: 1 }, { b: 2 }],
          error: { kind: 'agent_failed', message: 'hiba' },
        },
      });
    });

    it('a hiányzó név nem kerül a globális objektumra', async () => {
      const result = await runScript(
        request(
          'return [typeof item, typeof itemIndex, typeof iteration, typeof joinInputs, typeof error, "item" in globalThis];',
        ),
      );
      expect(result).toStrictEqual({
        kind: 'succeeded',
        output: ['undefined', 'undefined', 'undefined', 'undefined', 'undefined', false],
      });
    });

    it('a kontextus értéke másolat: a szkript módosítása a gazda objektumot nem érinti', async () => {
      const runContext: RunContext = { ...MINIMAL_CONTEXT, input: { name: 'teszt' } };
      await runScript(request('input.name = "más"; return 1;', { runContext }));
      expect(runContext.input).toStrictEqual({ name: 'teszt' });
    });

    it('a globális objektum kulcslistája pontosan a QuickJS 61 neve, a fetch, a files és a jelen lévő kontextus nevek', async () => {
      // A kulcslista egyezését halmazként vizsgáljuk: minden várt név benne van, és a darabszám azonos.
      const namesSource = 'return Object.getOwnPropertyNames(globalThis);';
      const countSource = 'return Object.getOwnPropertyNames(globalThis).length;';
      const minimalNames = [...QUICKJS_GLOBAL_NAMES, 'fetch', 'files', 'input', 'steps'];
      const minimalOutput = outputOf(await runScript(request(namesSource)));
      expect(minimalOutput).toStrictEqual(expect.arrayContaining(minimalNames));
      await expect(runScript(request(countSource))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: minimalNames.length,
      });
      const fullNames = [...minimalNames, 'item', 'itemIndex', 'iteration', 'joinInputs', 'error'];
      const fullOutput = outputOf(await runScript(request(namesSource, { runContext: FULL_CONTEXT })));
      expect(fullOutput).toStrictEqual(expect.arrayContaining(fullNames));
      await expect(runScript(request(countSource, { runContext: FULL_CONTEXT }))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: fullNames.length,
      });
    });
  });

  describe('hibák', () => {
    it('a szintaktikai hiba script_evaluation_failed', async () => {
      const result = await runScript(request('return {'));
      expect(result).toMatchObject({ kind: 'failed', errorKind: 'script_evaluation_failed' });
      expect(result).toHaveProperty('message', expect.stringContaining('SyntaxError'));
    });

    it('a dobott Error neve és üzenete a hibaüzenetben áll, a verem nem', async () => {
      const result = await runScript(request('throw new TypeError("rossz bemenet");'));
      expect(result).toStrictEqual({
        kind: 'failed',
        errorKind: 'script_evaluation_failed',
        message: 'a szkript hibát dobott: TypeError: rossz bemenet',
      });
    });

    it('a nem Error dobott érték rögzített mondatot kap', async () => {
      await expect(runScript(request('throw 42;'))).resolves.toStrictEqual({
        kind: 'failed',
        errorKind: 'script_evaluation_failed',
        message: 'a szkript hibát dobott: a dobott érték nem Error objektum',
      });
    });

    it.each([
      ['undefined', 'return undefined;'],
      ['return nélkül', 'const x = 1;'],
      ['függvény', 'return () => 1;'],
    ])('a nem JSON eredmény script_output_not_json: %s', async (_name, source) => {
      await expect(runScript(request(source))).resolves.toMatchObject({
        kind: 'failed',
        errorKind: 'script_output_not_json',
        message: 'a szkript visszatérési értéke nem JSON érték (például undefined vagy függvény)',
      });
    });

    it.each([
      ['körkörös', 'const a = {}; a.self = a; return a;'],
      ['BigInt', 'return 10n;'],
    ])('a JSON szöveggé nem alakítható eredmény script_output_not_json: %s', async (_name, source) => {
      const result = await runScript(request(source));
      expect(result).toMatchObject({ kind: 'failed', errorKind: 'script_output_not_json' });
      expect(result).toHaveProperty(
        'message',
        expect.stringMatching(/^a szkript visszatérési értéke nem alakítható JSON szöveggé: TypeError: /u),
      );
    });
  });

  describe('időkorlát és megszakítás', () => {
    it('a CPU kötött végtelen ciklust az interrupt kezelő állítja meg', async () => {
      await expect(runScript(request('while (true) {}', { timeoutMs: 50 }))).resolves.toStrictEqual({
        kind: 'failed',
        errorKind: 'script_timed_out',
        message: 'a szkript nem fejeződött be 50 ms alatt',
      });
    });

    it('a mikrofeladatokkal pörgő szkript is időkorlátba fut', async () => {
      await expect(runScript(request('for (;;) { await null; }', { timeoutMs: 50 }))).resolves.toMatchObject({
        kind: 'failed',
        errorKind: 'script_timed_out',
      });
    });

    it('a soha fel nem oldott ígéretre váró szkriptet a gazda határideje állítja meg', async () => {
      await expect(
        runScript(request('await new Promise(() => {}); return 1;', { timeoutMs: 50 })),
      ).resolves.toStrictEqual({
        kind: 'failed',
        errorKind: 'script_timed_out',
        message: 'a szkript nem fejeződött be 50 ms alatt',
      });
    });

    it('a kérés jele a várakozó szkriptet megszakítja', async () => {
      const controller = new AbortController();
      const running = runScript(request('await new Promise(() => {}); return 1;', { signal: controller.signal }));
      setTimeout(() => {
        controller.abort();
      }, 20);
      await expect(running).resolves.toStrictEqual({ kind: 'aborted' });
    });

    it('a CPU kötött szkript alatt a kérés jele nem ér célba, mert a gazda szála foglalt: a határidő állítja meg', async () => {
      // A megszakítás ugyanazon a szálon fut, mint a QuickJS, tehát a szinkron ciklus alatt el sem indulhat
      // (research `2026-11-04-szkript-csomopont.md` 9.3): az időzítő a lépés vége után sül el.
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, 20);
      const result = await runScript(request('while (true) {}', { timeoutMs: 300, signal: controller.signal }));
      const wasAbortedBeforeResult = controller.signal.aborted;
      clearTimeout(timer);
      expect(result).toStrictEqual({
        kind: 'failed',
        errorKind: 'script_timed_out',
        message: 'a szkript nem fejeződött be 300 ms alatt',
      });
      expect(wasAbortedBeforeResult).toBe(false);
    });

    it('a már megszakított jel mellett a szkript el sem indul', async () => {
      const controller = new AbortController();
      controller.abort();
      await expect(runScript(request('return 1;', { signal: controller.signal }))).resolves.toStrictEqual({
        kind: 'aborted',
      });
    });
  });

  describe('memória és stack', () => {
    it('a memória túllépés a sandboxban elkapható', async () => {
      const source =
        'const a = []; try { while (true) { a.push(new Array(1e5).fill(1)); } } catch (e) { a.length = 0; return e.name + ": " + e.message; }';
      await expect(runScript(request(source, { memoryLimitMb: 16 }))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: 'InternalError: out of memory',
      });
    });

    it('az el nem kapott memória túllépés script_evaluation_failed', async () => {
      const source = 'const a = []; while (true) { a.push(new Array(1e5).fill(1)); }';
      await expect(runScript(request(source, { memoryLimitMb: 16 }))).resolves.toStrictEqual({
        kind: 'failed',
        errorKind: 'script_evaluation_failed',
        message: 'a szkript hibát dobott: InternalError: out of memory',
      });
    });

    it('a mély rekurzió a sandboxban marad és elkapható', async () => {
      const source = 'function g() { return 1 + g(); } try { g(); } catch (e) { return e.name + ": " + e.message; }';
      await expect(runScript(request(source))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: 'InternalError: stack overflow',
      });
    });

    it('a gazdára kijutó RangeError script_evaluation_failed, és utána egy új lépés hibátlanul fut', async () => {
      const source = 'let o = {}; let c = o; for (let i = 0; i < 1e5; i++) { c.x = {}; c = c.x; } return o;';
      await expect(runScript(request(source))).resolves.toStrictEqual({
        kind: 'failed',
        errorKind: 'script_evaluation_failed',
        message: 'a szkript futása a gazda oldalon megszakadt (RangeError)',
      });
      await expect(runScript(request('return input.name;'))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: 'teszt',
      });
    });
  });
});
