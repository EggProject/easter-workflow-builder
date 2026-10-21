// T-010-2 blokkoló CEL mérés, eldobható, repón kívüli script.
// Futtatás: node meres.mjs <pont>   (pont: 1 2 3 4 4b 5 6 7 8, vagy all)
import { inspect } from 'node:util';
import os from 'node:os';
import { Environment, ParseError, EvaluationError, TypeError as CelTypeError } from '@marcbachmann/cel-js';

// SPEC-010 7.1: a hét RunContext név, mind dyn, minden más a csomag alapértéke.
const RUN_CONTEXT_VARIABLE_NAMES = ['input', 'steps', 'item', 'itemIndex', 'iteration', 'joinInputs', 'error'];
function createEnv() {
  const env = new Environment();
  for (const name of RUN_CONTEXT_VARIABLE_NAMES) env.registerVariable(name, 'dyn');
  return env;
}
const env = createEnv();

// Valós alakú RunContext: a packages/engine run-context.ts mezői, a buildRunContext
// kimenetének alakjában (input JSON adat, steps node azonosító -> kimenet,
// a hatókörön kívüli mezők undefined). Egy loop hatókörben futó lépés pillanatképe.
const runContext = {
  input: {
    tema: 'x',
    pontszam: 72,
    darab: 3,
    elemek: [
      { nev: 'alma', aktiv: true },
      { nev: 'körte', aktiv: false },
      { nev: 'szilva', aktiv: true },
    ],
  },
  steps: {
    ellenorzes: { kesz: false },
    'kötőjeles-azonosító': { mezo: 'érték', mező: 'ékezetes kulcs' },
    'llm-1': { text: 'válasz' },
  },
  item: undefined,
  itemIndex: undefined,
  iteration: 2,
  joinInputs: undefined,
  error: undefined,
};

// SPEC-010 7.3 leképezés: felső szintű undefined -> null; itemIndex, iteration -> BigInt.
function toCelContext(ctx) {
  const out = {};
  for (const name of RUN_CONTEXT_VARIABLE_NAMES) {
    const v = ctx[name];
    if (v === undefined) out[name] = null;
    else if ((name === 'itemIndex' || name === 'iteration') && Number.isInteger(v)) out[name] = BigInt(v);
    else out[name] = v;
  }
  return out;
}
const celCtx = toCelContext(runContext);

function protoName(v) {
  if (v === null || (typeof v !== 'object' && typeof v !== 'function')) return '(primitív)';
  const proto = Object.getPrototypeOf(v);
  if (proto === null) return 'null';
  if (proto === Object.prototype) return 'Object.prototype';
  if (proto === Array.prototype) return 'Array.prototype';
  return `${proto.constructor?.name}.prototype`;
}
function describeValue(v) {
  return {
    inspect: inspect(v, { depth: 4 }),
    typeof: typeof v,
    constructorName: v?.constructor?.name,
    prototype: protoName(v),
    isPromise: v instanceof Promise,
    ...(typeof v === 'bigint'
      ? { safeInteger: Number.isSafeInteger(Number(v)) && BigInt(Number(v)) === v, asNumber: Number(v) }
      : {}),
    ...(typeof v === 'number' ? { finite: Number.isFinite(v), isNaN: Number.isNaN(v) } : {}),
  };
}
function describeError(e) {
  return {
    name: e?.name,
    class:
      e instanceof ParseError
        ? 'ParseError'
        : e instanceof EvaluationError
          ? 'EvaluationError'
          : e instanceof CelTypeError
            ? 'cel TypeError'
            : e?.constructor?.name,
    code: e?.code,
    summary: e?.summary,
    range: e?.range,
    message: e?.message,
  };
}
function evaluate(expr, ctx = celCtx) {
  try {
    return { ok: true, value: describeValue(env.evaluate(expr, ctx)) };
  } catch (e) {
    return { ok: false, error: describeError(e) };
  }
}
// SPEC-010 7.2: env.parse, majd env.check.
function compile(expr) {
  try {
    env.parse(expr);
  } catch (e) {
    return { ok: false, stage: 'parse', error: describeError(e) };
  }
  const r = env.check(expr);
  if (!r.valid) return { ok: false, stage: 'check', error: describeError(r.error) };
  return { ok: true, type: r.type };
}
function show(title, obj) {
  console.log(`### ${title}`);
  console.log(inspect(obj, { depth: 6, breakLength: 120 }));
}
function fragmentCheck(summary, expr) {
  const tokens = [...new Set(expr.match(/[A-Za-z_][A-Za-z0-9_\-]{3,}/g) ?? [])];
  return tokens.filter((t) => summary?.includes(t));
}

const points = {
  1() {
    for (const expr of [
      'input.pontszam >= 50.0 ? "magas" : "alacsony"',
      'input.elemek.filter(e, e.aktiv).map(e, e.nev)',
      'iteration < 3',
      'steps["ellenorzes"].kesz == false',
    ])
      show(expr, { compile: compile(expr), evaluate: evaluate(expr) });
  },
  2() {
    const cases = {
      'szintaktikai hiba: 1 +': '1 +',
      'szintaktikai hiba: input.(': 'input.(',
      'nem deklarált változó: step.x': 'step.x',
      'nem deklarált változó: stepsx == 1': 'stepsx == 1',
      'maxDepth túllépés: 300 zárójel': '('.repeat(300) + '1' + ')'.repeat(300),
      'maxDepth túllépés: 300 unáris mínusz': '-'.repeat(300) + '1',
      'maxDepth túllépés: 260 egymásba ágyazott lista': '['.repeat(260) + '1' + ']'.repeat(260),
      'határ alatt: 240 zárójel': '('.repeat(240) + '1' + ')'.repeat(240),
      'határ alatt: 120 egymásba ágyazott lista': '['.repeat(120) + '1' + ']'.repeat(120),
      'érvényes: branch példa': 'input.pontszam >= 50.0 ? "magas" : "alacsony"',
      'érvényes: fan_out példa': 'input.elemek.filter(e, e.aktiv).map(e, e.nev)',
      'érvényes: loop példa': 'iteration < 3',
      'érvényes: loop példa 2': 'steps["ellenorzes"].kesz == false',
      'érvényes: has védett': 'has(input.prioritas) ? input.prioritas : "normal"',
    };
    for (const [k, expr] of Object.entries(cases)) {
      const r = compile(expr);
      show(
        k,
        r.ok
          ? r
          : {
              ok: r.ok,
              stage: r.stage,
              name: r.error.name,
              class: r.error.class,
              code: r.error.code,
              summary: r.error.summary,
              range: r.error.range,
            },
      );
    }
  },
  3() {
    show('celCtx (a 7.3 leképezés után)', celCtx);
    show('item == null (leképezéssel, item undefined -> null)', evaluate('item == null'));
    show('item == null (leképezés NÉLKÜL, item: undefined)', evaluate('item == null', runContext));
    show('iteration + 1 (leképezéssel, 2n)', evaluate('iteration + 1'));
    show('iteration + 1 (leképezés NÉLKÜL, number 2)', evaluate('iteration + 1', runContext));
    show('iteration < 3 (leképezés NÉLKÜL, number 2)', evaluate('iteration < 3', runContext));
    show('input.darab + 1.0', evaluate('input.darab + 1.0'));
    show('input.darab + 1', evaluate('input.darab + 1'));
    show('input.darab > 1', evaluate('input.darab > 1'));
    show('input.darab == 3', evaluate('input.darab == 3'));
    show('compile: input.darab + 1 (dyn mellett a check elfogadja-e)', compile('input.darab + 1'));
  },
  4() {
    const cases = {
      string: '"szöveg"',
      boolean: 'true',
      null: 'null',
      'double véges': '1.5 + 2.5',
      'NaN (0.0/0.0)': '0.0 / 0.0',
      'Infinity (1.0/0.0)': '1.0 / 0.0',
      '-Infinity (-1.0/0.0)': '-1.0 / 0.0',
      'NaN double("NaN")': 'double("NaN")',
      'int (BigInt)': '1 + 2',
      'int nem biztonságos (2^53+1)': '9007199254740993',
      'int max': '9223372036854775807',
      'uint (UnsignedInt)': '1u',
      'bytes (Uint8Array)': 'b"abc"',
      időbélyeg: 'timestamp("2026-01-01T00:00:00Z")',
      időtartam: 'duration("1s")',
      'típus érték': 'type(1)',
      'lista literál': '[1, 2, 3]',
      'lista makróból (filter/map)': 'input.elemek.filter(e, e.aktiv).map(e, e.nev)',
      'lista a kontextusból változatlanul': 'input.elemek',
      'map literál, string kulcs': '{"a": 1, "b": 2}',
      'map a kontextusból változatlanul': 'input',
      'map nem string kulcs (int)': '{1: "a", 2: "b"}',
      'map nem string kulcs (bool)': '{true: "a"}',
      'map nem string kulcs (uint)': '{1u: "a"}',
      'lista vegyes elemmel (dyn)': '[dyn(1), dyn("a"), dyn(1u)]',
    };
    for (const [k, expr] of Object.entries(cases)) {
      const r = evaluate(expr);
      if (r.ok) {
        const raw = env.evaluate(expr, celCtx);
        if (raw !== null && typeof raw === 'object') {
          r.extra = {
            isMap: raw instanceof Map,
            isArray: Array.isArray(raw),
            ownKeys: Reflect.ownKeys(raw).map(String),
            keyTypes: raw instanceof Map ? [...raw.keys()].map((x) => typeof x) : undefined,
            elems: Array.isArray(raw) ? raw.map((x) => `${typeof x}/${protoName(x)}`) : undefined,
            sameRefAsContext: raw === celCtx.input || raw === celCtx.input.elemek,
          };
        }
        try {
          r.plainJsonStringify = JSON.stringify(raw);
        } catch (e) {
          r.plainJsonStringify = `throws ${e.name}: ${e.message}`;
        }
      }
      show(`${k}: ${expr}`, r);
    }
  },
  '4b'() {
    const parseCases = {
      'szintaxis, titok szerű literállal': '"SECRET_LITERAL" +',
      'szintaxis: input.(': 'input.(',
      'nem deklarált: step.x': 'step.x',
      'nem deklarált: titokNeve': 'titokNeve == "x"',
      maxDepth: '('.repeat(300) + '1' + ')'.repeat(300),
    };
    for (const [k, expr] of Object.entries(parseCases)) {
      const c = compile(expr);
      const e = c.error;
      show(`compile ${k}: ${expr.length > 60 ? expr.slice(0, 20) + '...' : expr}`, {
        stage: c.stage,
        ...e,
        message: e.message.length > 400 ? e.message.slice(0, 400) + '...[csonkolva a jegyzőkönyvben]' : e.message,
        summaryContainsExprFragment: fragmentCheck(e.summary, expr),
      });
    }
    const evalCases = {
      'hiányzó kulcs': 'input.TITKOS_KULCS_NEV',
      'nem illeszkedő overload, string literállal': 'input.darab + "SECRET_LITERAL"',
      'int + double': 'input.darab + 1',
      'hiányzó kulcs index alakban': 'steps["nincs-ilyen-SECRET"]',
      'nulla osztó int': '1 / 0',
      'mező kiválasztás számon': 'input.darab.x',
    };
    for (const [k, expr] of Object.entries(evalCases)) {
      const r = evaluate(expr);
      show(
        `evaluate ${k}: ${expr}`,
        r.ok ? r : { ...r.error, summaryContainsExprFragment: fragmentCheck(r.error.summary, expr) },
      );
    }
  },
  5() {
    show('input.hianyzo', evaluate('input.hianyzo'));
    show('steps["nincs"].x', evaluate('steps["nincs"].x'));
    show('has(input.hianyzo)', evaluate('has(input.hianyzo)'));
    show('has(input.tema)', evaluate('has(input.tema)'));
    show(
      'has(input.prioritas) ? input.prioritas : "normal"',
      evaluate('has(input.prioritas) ? input.prioritas : "normal"'),
    );
    show('has(steps.nincs)', evaluate('has(steps.nincs)'));
    show('item.x (item null)', evaluate('item.x'));
    show('has(item.x) (item null)', evaluate('has(item.x)'));
  },
  6() {
    show('steps["kötőjeles-azonosító"].mezo', evaluate('steps["kötőjeles-azonosító"].mezo'));
    show(
      'steps["kötőjeles-azonosító"].mező (ékezetes mezőnév szelektorként)',
      evaluate('steps["kötőjeles-azonosító"].mező'),
    );
    show('steps["kötőjeles-azonosító"]["mező"]', evaluate('steps["kötőjeles-azonosító"]["mező"]'));
    show('steps["llm-1"].text', evaluate('steps["llm-1"].text'));
    show('steps.llm-1 (kötőjel operátorként)', evaluate('steps.llm-1'));
    show('compile steps["kötőjeles-azonosító"].mezo', compile('steps["kötőjeles-azonosító"].mezo'));
  },
  7() {
    for (const expr of [
      'input.constructor',
      'input.__proto__',
      'input.toString',
      'input.hasOwnProperty',
      'input["constructor"]',
      'input["__proto__"]',
      'input["toString"]',
      'has(input.constructor)',
      'has(input.toString)',
      'steps.constructor',
      '"constructor" in input',
      '"toString" in input',
      'input.elemek.constructor',
      'input.tema.constructor',
      '{}.constructor',
    ])
      show(expr, { compile: compile(expr), evaluate: evaluate(expr) });
    const ctx = {
      ...celCtx,
      input: JSON.parse('{"constructor":"saját","__proto__":"saját proto","toString":"saját ts"}'),
    };
    show('saját constructor kulcs (JSON.parse): input.constructor', evaluate('input.constructor', ctx));
    show('saját __proto__ kulcs (JSON.parse): input["__proto__"]', evaluate('input["__proto__"]', ctx));
    show('saját toString kulcs (JSON.parse): input.toString', evaluate('input.toString', ctx));
  },
  8() {
    show('gép', {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      nproc: os.availableParallelism(),
      cpuModel: os.cpus()[0]?.model,
      totalMemGiB: (os.totalmem() / 2 ** 30).toFixed(1),
    });
    const make = (n) => ({
      ...celCtx,
      input: {
        ...celCtx.input,
        lista: Array.from({ length: n }, (_, i) => ({ id: i, ertek: i * 1.5, aktiv: i % 2 === 0 })),
      },
    });
    const plan = [
      ['egyszintű (filter+map)', 'input.lista.filter(e, e.aktiv).map(e, e.ertek)', [1000, 10000, 100000]],
      [
        'kétszintű beágyazott (all/exists)',
        'input.lista.all(x, input.lista.exists(y, y.id == x.id))',
        [100, 1000, 3000],
      ],
      [
        'kétszintű beágyazott (map/filter.size)',
        'input.lista.map(x, input.lista.filter(y, y.ertek > x.ertek).size())',
        [100, 1000, 3000],
      ],
      [
        'háromszintű beágyazott (exists x3, végig hamis)',
        'input.lista.exists(x, input.lista.exists(y, input.lista.exists(z, x.id + y.id + z.id < 0.0)))',
        [10, 50, 100],
      ],
    ];
    for (const [name, expr, sizes] of plan) {
      const parsed = env.parse(expr);
      for (const n of sizes) {
        const ctx = make(n);
        const first = parsed(ctx);
        const times = [];
        for (let i = 0; i < 5; i++) {
          const t0 = process.hrtime.bigint();
          parsed(ctx);
          times.push(Number(process.hrtime.bigint() - t0) / 1e6);
        }
        times.sort((a, b) => a - b);
        const res = Array.isArray(first) ? `lista, ${first.length} elem` : inspect(first);
        console.log(
          `${name} | n=${n} | eredmény: ${res} | min ${times[0].toFixed(2)} ms | medián ${times[2].toFixed(2)} ms | max ${times[4].toFixed(2)} ms`,
        );
      }
    }
  },
};

const arg = process.argv[2] ?? 'all';
const order = ['1', '2', '3', '4', '4b', '5', '6', '7', '8'];
for (const p of arg === 'all' ? order : [arg]) {
  console.log(`\n================ (${p}) ================`);
  points[p]();
}
