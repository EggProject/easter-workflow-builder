/* eslint-disable unicorn/no-null -- a port `timeoutMs`, `cwd` és `memoryLimitMb` mezőjének üres értéke a tárolt `null` (SPEC-014 5.3), és a szkript `null` kimenete is JSON érték */
import type { RunContext, ScriptRunRequest, ScriptRunResult } from '@easter-workflow-builder/engine';
import { describe, expect, it } from 'vitest';
import { buildSandboxRunRequest } from './build-sandbox-run-request.ts';
import { runScript } from './run-script.ts';

// A szkript folyamatában futó `runScript` közvetlenül, a szülő kérés leképezésével (SPEC-017 4.2).
function run(scriptRequest: ScriptRunRequest): ReturnType<typeof runScript> {
  return runScript(buildSandboxRunRequest(scriptRequest, Date.now()), () => false);
}

// A friss kontextus 61 globális nevéből (research `2026-11-04-szkript-csomopont.md` Q-8) a
// `FinalizationRegistry` és a `WeakRef` törlése utáni 59 név (SPEC-014 5.4 "Eltávolított nevek").
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
    fetchResponseLimitMb: null,
    fileReadLimitMb: null,
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
      await expect(run(request('return { a: 1, b: [true, "x"] };'))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: { a: 1, b: [true, 'x'] },
      });
      await expect(run(request('return [1, 2, 3];'))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: [1, 2, 3],
      });
      await expect(run(request('return 42.5;'))).resolves.toStrictEqual({ kind: 'succeeded', output: 42.5 });
      await expect(run(request('return null;'))).resolves.toStrictEqual({ kind: 'succeeded', output: null });
    });

    it('a törzsben await használható', async () => {
      await expect(run(request('const x = await Promise.resolve(input.name); return x + "!";'))).resolves.toStrictEqual(
        {
          kind: 'succeeded',
          output: 'teszt!',
        },
      );
    });

    it('a null időkorláttal és null memória korláttal is fut (az alapértékek)', async () => {
      await expect(
        run(
          request('return 1;', {
            timeoutMs: null,
            memoryLimitMb: null,
            fetchResponseLimitMb: null,
            fileReadLimitMb: null,
          }),
        ),
      ).resolves.toStrictEqual({
        kind: 'succeeded',
        output: 1,
      });
    });
  });

  describe('a futás kontextus nevei', () => {
    it('a hét név JSON értékként látszik', async () => {
      const result = await run(
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
      const result = await run(
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
      await run(request('input.name = "más"; return 1;', { runContext }));
      expect(runContext.input).toStrictEqual({ name: 'teszt' });
    });

    it('a globális objektum kulcslistája pontosan a QuickJS 59 megmaradt neve, a fetch, a files és a jelen lévő kontextus nevek', async () => {
      // A kulcslista egyezését halmazként vizsgáljuk: minden várt név benne van, és a darabszám azonos.
      const namesSource = 'return Object.getOwnPropertyNames(globalThis);';
      const countSource = 'return Object.getOwnPropertyNames(globalThis).length;';
      const minimalNames = [...QUICKJS_GLOBAL_NAMES, 'fetch', 'files', 'input', 'steps'];
      const minimalOutput = outputOf(await run(request(namesSource)));
      expect(minimalOutput).toStrictEqual(expect.arrayContaining(minimalNames));
      await expect(run(request(countSource))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: minimalNames.length,
      });
      const fullNames = [...minimalNames, 'item', 'itemIndex', 'iteration', 'joinInputs', 'error'];
      const fullOutput = outputOf(await run(request(namesSource, { runContext: FULL_CONTEXT })));
      expect(fullOutput).toStrictEqual(expect.arrayContaining(fullNames));
      await expect(run(request(countSource, { runContext: FULL_CONTEXT }))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: fullNames.length,
      });
    });
  });

  describe('a pinelt QuickJS ismert hibáit hordozó hat név (SPEC-014 5.4, T-4)', () => {
    const SIX_NAMES = ['toReversed', 'with', 'toSpliced', 'toSorted', 'FinalizationRegistry', 'WeakRef'];

    it('a hat név a szkript futásakor nem érhető el: az Array és a TypedArray prototípuson és a globális objektumon sincs', async () => {
      const source = `
        const typedArrays = [Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array,
          Uint32Array, Float16Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array];
        const methods = ["toReversed", "with", "toSpliced", "toSorted"];
        return {
          array: methods.map((name) => typeof [][name]),
          typedArray: typedArrays.flatMap((C) => methods.map((name) => typeof new C(1)[name])),
          global: [typeof FinalizationRegistry, typeof WeakRef, "WeakRef" in globalThis],
        };`;
      const result = await run(request(source));
      expect(outputOf(result)).toStrictEqual({
        array: ['undefined', 'undefined', 'undefined', 'undefined'],
        typedArray: Array.from({ length: 48 }, () => 'undefined'),
        global: ['undefined', 'undefined', false],
      });
    });

    it('a törölt függvény a globális objektumból bejárható gráfban sehol nem marad, tehát a szkript nem állíthatja vissza', async () => {
      // A bejárás a tulajdonság leírókat olvassa (getter hívás nélkül), és a
      // prototípus láncot is követi; egy natív függvény neve a törölt név.
      const source = `
        const names = new Set(${JSON.stringify(SIX_NAMES)});
        const seen = new Set();
        const queue = [globalThis];
        const found = [];
        while (queue.length > 0) {
          const value = queue.pop();
          if (value === null || (typeof value !== "object" && typeof value !== "function") || seen.has(value)) continue;
          seen.add(value);
          if (typeof value === "function" && names.has(Object.getOwnPropertyDescriptor(value, "name")?.value)) {
            found.push(Object.getOwnPropertyDescriptor(value, "name").value);
          }
          queue.push(Object.getPrototypeOf(value));
          for (const key of Reflect.ownKeys(value)) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            queue.push(descriptor.value, descriptor.get, descriptor.set);
          }
        }
        return { found, visited: seen.size > 100 };`;
      const result = await run(request(source));
      expect(outputOf(result)).toStrictEqual({ found: [], visited: true });
    });

    it('az eval, a Function konstruktor és a Reflect sem éri el a törölt neveket', async () => {
      const source = `return [
        eval("typeof [].toSorted"),
        new Function("return typeof WeakRef")(),
        typeof Reflect.get(Array.prototype, "toSpliced"),
        typeof Reflect.get(Object.getPrototypeOf(Uint8Array.prototype), "with"),
        Object.getOwnPropertyNames(Array.prototype).filter((name) => ${JSON.stringify(SIX_NAMES)}.includes(name)),
      ];`;
      const result = await run(request(source));
      expect(outputOf(result)).toStrictEqual(['undefined', 'undefined', 'undefined', 'undefined', []]);
    });

    it('a megmaradt Array és TypedArray metódusok működnek', async () => {
      await expect(
        run(request('return [[3, 1, 2].slice().sort(), [...new Uint8Array([3, 1]).reverse()], [1, 2].at(-1)];')),
      ).resolves.toStrictEqual({ kind: 'succeeded', output: [[1, 2, 3], [1, 3], 2] });
    });
  });

  describe('a /proc és a /dev gyökér tiltása (user döntés 2026-11-04)', () => {
    it.each(['/dev', '/dev/../dev/shm', '/proc/self'])(
      'a(z) %s cwd a szkript indítása előtt megnevezett script_evaluation_failed',
      async (cwd) => {
        await expect(run(request('return 1;', { cwd }))).resolves.toStrictEqual({
          kind: 'failed',
          errorKind: 'script_evaluation_failed',
          message: 'a szkript fájl hozzáférésének gyökere (cwd) a tiltott /proc vagy /dev könyvtárba mutat',
        });
      },
    );

    it('a / gyökér alatt a szkript a dev/zero olvasásakor elkapható hibát kap, a szerver folyamat környezete nem olvasható', async () => {
      const result = await run(
        request(
          'const out = []; for (const p of ["dev/zero", "proc/self/environ", "dev"]) {' +
            ' try { await (p === "dev" ? files.list(p) : files.readText(p)); out.push("olvasva"); }' +
            ' catch (e) { out.push(e.message); } } return out;',
          { cwd: '/' },
        ),
      );
      expect(result).toStrictEqual({
        kind: 'succeeded',
        output: [
          'az útvonal a tiltott /proc vagy /dev könyvtárba mutat: dev/zero',
          'az útvonal a tiltott /proc vagy /dev könyvtárba mutat: proc/self/environ',
          'az útvonal a tiltott /proc vagy /dev könyvtárba mutat: dev',
        ],
      });
    });
  });

  describe('hibák', () => {
    it('a szintaktikai hiba script_evaluation_failed', async () => {
      const result = await run(request('return {'));
      expect(result).toMatchObject({ kind: 'failed', errorKind: 'script_evaluation_failed' });
      expect(result).toHaveProperty('message', expect.stringContaining('SyntaxError'));
    });

    it('a dobott Error neve és üzenete a hibaüzenetben áll, a verem nem', async () => {
      const result = await run(request('throw new TypeError("rossz bemenet");'));
      expect(result).toStrictEqual({
        kind: 'failed',
        errorKind: 'script_evaluation_failed',
        message: 'a szkript hibát dobott: TypeError: rossz bemenet',
      });
    });

    it('a nem Error dobott érték rögzített mondatot kap', async () => {
      await expect(run(request('throw 42;'))).resolves.toStrictEqual({
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
      await expect(run(request(source))).resolves.toMatchObject({
        kind: 'failed',
        errorKind: 'script_output_not_json',
        message: 'a szkript visszatérési értéke nem JSON érték (például undefined vagy függvény)',
      });
    });

    it.each([
      ['körkörös', 'const a = {}; a.self = a; return a;'],
      ['BigInt', 'return 10n;'],
    ])('a JSON szöveggé nem alakítható eredmény script_output_not_json: %s', async (_name, source) => {
      const result = await run(request(source));
      expect(result).toMatchObject({ kind: 'failed', errorKind: 'script_output_not_json' });
      expect(result).toHaveProperty(
        'message',
        expect.stringMatching(/^a szkript visszatérési értéke nem alakítható JSON szöveggé: TypeError: /u),
      );
    });
  });

  describe('a sandbox Promise felülírása (T-015-12)', () => {
    // A könyvtár `resolvePromise` hívása a futás idejű `Promise.resolve` és `then` értéket hívja
    // (quickjs-emscripten-core 0.32.0); a szkript felülírása a gazda ígéretét elutasítja. A javítás
    // előtt ez kezeletlen elutasítás volt a gazdán (a Node alapból leállítja tőle a folyamatot).
    it.each([
      ['Promise.prototype.then', 'Promise.prototype.then = function () { throw new Error("x"); }; return 1;'],
      [
        'a globális Promise',
        'globalThis.Promise = { resolve() { return { then() { throw new Error("y"); } }; } }; return 1;',
      ],
    ])('a(z) %s felülírása azonnal script_evaluation_failed, kezeletlen elutasítás nélkül', async (_name, source) => {
      await expect(run(request(source))).resolves.toStrictEqual({
        kind: 'failed',
        errorKind: 'script_evaluation_failed',
        message: 'a szkript futása a gazda oldalon megszakadt (QuickJSUnwrapError)',
      });
    });
  });

  describe('időkorlát', () => {
    it('a szülő elvesztésekor a CPU kötött ciklus a határidő előtt megáll (SPEC-017 4.1)', async () => {
      const request60 = buildSandboxRunRequest(request('while (true) {}', { timeoutMs: 60_000 }), Date.now());
      await expect(runScript(request60, () => true)).resolves.toStrictEqual({
        kind: 'failed',
        errorKind: 'script_timed_out',
        message: 'a szkript nem fejeződött be 60000 ms alatt',
      });
    });

    it('a CPU kötött végtelen ciklust az interrupt kezelő állítja meg', async () => {
      await expect(run(request('while (true) {}', { timeoutMs: 50 }))).resolves.toStrictEqual({
        kind: 'failed',
        errorKind: 'script_timed_out',
        message: 'a szkript nem fejeződött be 50 ms alatt',
      });
    });

    it('a mikrofeladatokkal pörgő szkript is időkorlátba fut', async () => {
      await expect(run(request('for (;;) { await null; }', { timeoutMs: 50 }))).resolves.toMatchObject({
        kind: 'failed',
        errorKind: 'script_timed_out',
      });
    });

    it('az 1 ms-os határidő is script_timed_out: az interrupt kezelő csak a szkript előtt áll be (T-015-12)', async () => {
      await expect(run(request('while (true) {}', { timeoutMs: 1 }))).resolves.toStrictEqual({
        kind: 'failed',
        errorKind: 'script_timed_out',
        message: 'a szkript nem fejeződött be 1 ms alatt',
      });
    });

    it('a dobott érték leírásában (getter) futó és megszakított kód is script_timed_out (T-015-12)', async () => {
      const source = 'throw { name: "x", get message() { for (;;) {} } };';
      await expect(run(request(source, { timeoutMs: 50 }))).resolves.toStrictEqual({
        kind: 'failed',
        errorKind: 'script_timed_out',
        message: 'a szkript nem fejeződött be 50 ms alatt',
      });
    });

    // A gazda függvény argumentumát a gazda a sandbox `JSON.stringify`-jával olvassa, tehát a szkript
    // `toJSON`-ja a gazda hívásán belül fut. Az ott megszakított kód hibáját a könyvtár a sandboxba
    // elkapható hibaként dobja vissza; a javítás előtt a szkript ezt elkapva a határidőn túl is futott,
    // és a szinkron ciklus a gazda szálát (az eseményhurkot) korlát nélkül foglalta (T-015-12). A ciklus
    // itt 1000 ms-ra korlátos, hogy egy visszatérő hiba ne akassza meg a tesztfuttatást.
    it.each([
      ['fetch', 'fetch(argument)'],
      ['files.readText', 'files.readText(argument)'],
      ['files.writeText', 'files.writeText(argument, "x")'],
      ['files.list', 'files.list(argument)'],
    ])(
      'a(z) %s argumentumában megszakított kód elkapása után a szkript nem fut tovább a határidőn túl',
      async (_name, call) => {
        const source = `const until = Date.now() + 1000; let caught = 0; const argument = { toJSON() { for (;;) {} } }; while (Date.now() < until) { try { ${call}; } catch { caught += 1; } } return caught;`;
        await expect(run(request(source, { timeoutMs: 50 }))).resolves.toStrictEqual({
          kind: 'failed',
          errorKind: 'script_timed_out',
          message: 'a szkript nem fejeződött be 50 ms alatt',
        });
      },
    );

    it('a soha fel nem oldott ígéretre váró szkriptet a gazda határideje állítja meg', async () => {
      await expect(run(request('await new Promise(() => {}); return 1;', { timeoutMs: 50 }))).resolves.toStrictEqual({
        kind: 'failed',
        errorKind: 'script_timed_out',
        message: 'a szkript nem fejeződött be 50 ms alatt',
      });
    });
  });

  describe('memória és stack', () => {
    it('a memória túllépés a sandboxban elkapható', async () => {
      const source =
        'const a = []; try { while (true) { a.push(new Array(1e5).fill(1)); } } catch (e) { a.length = 0; return e.name + ": " + e.message; }';
      await expect(
        run(request(source, { memoryLimitMb: 16, fetchResponseLimitMb: null, fileReadLimitMb: null })),
      ).resolves.toStrictEqual({
        kind: 'succeeded',
        output: 'InternalError: out of memory',
      });
    });

    it('az el nem kapott memória túllépés script_evaluation_failed', async () => {
      const source = 'const a = []; while (true) { a.push(new Array(1e5).fill(1)); }';
      await expect(
        run(request(source, { memoryLimitMb: 16, fetchResponseLimitMb: null, fileReadLimitMb: null })),
      ).resolves.toStrictEqual({
        kind: 'failed',
        errorKind: 'script_evaluation_failed',
        message: 'a szkript hibát dobott: InternalError: out of memory',
      });
    });

    it('a mély rekurzió a sandboxban marad és elkapható', async () => {
      const source = 'function g() { return 1 + g(); } try { g(); } catch (e) { return e.name + ": " + e.message; }';
      await expect(run(request(source))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: 'InternalError: stack overflow',
      });
    });

    it('a gazdára kijutó RangeError script_evaluation_failed, és utána egy új lépés hibátlanul fut', async () => {
      const source = 'let o = {}; let c = o; for (let i = 0; i < 1e5; i++) { c.x = {}; c = c.x; } return o;';
      await expect(run(request(source))).resolves.toStrictEqual({
        kind: 'failed',
        errorKind: 'script_evaluation_failed',
        message: 'a szkript futása a gazda oldalon megszakadt (RangeError)',
      });
      await expect(run(request('return input.name;'))).resolves.toStrictEqual({
        kind: 'succeeded',
        output: 'teszt',
      });
    });
  });
});
