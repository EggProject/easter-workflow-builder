// Közös mérési segédek a T-010-3 méréshez. Eldobható, repón kívüli kód.
import Mustache from 'mustache';

// Valós alakú RunContext: a packages/engine buildRunContext kimenetének alakja
// (minden kulcs jelen van, a hiányzó érték undefined), az input és a steps
// JSON kerekúton (step_run.output, M-106).
const jsonRoundTrip = (v) => JSON.parse(JSON.stringify(v));

export function baseRunContext(overrides = {}) {
  return {
    input: jsonRoundTrip({
      tema: 'Kód: <a href="x">\'&/`=',
      items: ['a', 'b'],
      elemek: ['x', 'y'],
      ures: [],
      szam: 42,
      nulla: 0,
      igaz: true,
      hamis: false,
      semmi: null,
      szoveg_ures: '',
      szerzo: { nev: 'Anna', kor: 30 },
      csoportok: [
        { nev: 'g1', tagok: ['t1', 't2'] },
        { nev: 'g2', tagok: [] },
      ],
      beagyazott: { a: { b: { c: 'mely' } } },
    }),
    steps: jsonRoundTrip({
      'node-1': { summary: 'kesz', score: 0.9, tags: ['t1', 't2'] },
      start: { tema: 'start tema' },
    }),
    item: undefined,
    itemIndex: undefined,
    iteration: undefined,
    joinInputs: undefined,
    error: undefined,
    ...overrides,
  };
}

// 6.5: a behelyettesített érték szöveggé alakítása.
function isPlainObject(v) {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}
export function toText(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return String(value);
  if (Array.isArray(value) || isPlainObject(value)) return JSON.stringify(value);
  return String(value);
}

// 6.6: saját tulajdonságra szűkített feloldás, függvényhívás nélkül.
// Konténer csak nem null objektum (sima objektum vagy tömb) lehet; a primitív
// érték tulajdonsága (pl. 'abc'.length) nem saját adat tulajdonság.
function isContainer(v) {
  return v !== null && typeof v === 'object';
}
function resolveInView(view, name) {
  if (name.indexOf('.') > 0) {
    const names = name.split('.');
    let current = view;
    for (const segment of names) {
      if (!isContainer(current) || !Object.hasOwn(current, segment)) return { found: false };
      current = current[segment];
    }
    return { found: true, value: current };
  }
  if (!isContainer(view) || !Object.hasOwn(view, name)) return { found: false };
  return { found: true, value: view[name] };
}

export const lookupLog = [];
export let logLookups = false;
export function setLogLookups(v) {
  logLookups = v;
}

export class OwnPropertyContext extends Mustache.Context {
  constructor(view, parentContext) {
    super(view, parentContext);
  }
  push(view) {
    return new OwnPropertyContext(view, this);
  }
  // {found, value}; a függvény értéket és az undefined értéket nem találtnak veszi.
  resolve(name) {
    if (name === '.') {
      return typeof this.view === 'function' || this.view === undefined
        ? { found: false }
        : { found: true, value: this.view };
    }
    let context = this;
    while (context !== undefined) {
      const r = resolveInView(context.view, name);
      if (r.found && r.value !== undefined && typeof r.value !== 'function') return r;
      context = context.parent;
    }
    return { found: false };
  }
  lookup(name) {
    const r = this.resolve(name);
    if (logLookups) {
      const stack = new Error().stack.split('\n').slice(2, 3).join('').trim();
      lookupLog.push({ name, found: r.found, caller: stack, ctxIsOwn: this instanceof OwnPropertyContext });
    }
    return r.found ? r.value : undefined;
  }
}

// A SPEC-010 6.2 szó szerinti útja: Mustache.render + Context alosztály + config.escape.
export function renderSpecPath(template, view) {
  try {
    return {
      ok: true,
      value: Mustache.render(template, new OwnPropertyContext(view, undefined), undefined, { escape: toText }),
    };
  } catch (e) {
    return { ok: false, error: String(e && e.message) };
  }
}

// A 6.7 megkülönböztetéshez: Writer alosztály, ami a sima változó tag két
// ágát (escapedValue, unescapedValue) felülírja. A config nem jut el az
// unescapedValue-hoz (mustache.mjs 657. sor), ezért mindkét ág a toText-et hívja.
export class MissingNameError extends Error {
  constructor(name) {
    super(`hiányzó név a sablonban: ${name}`);
    this.missingName = name;
  }
}
export class StrictWriter extends Mustache.Writer {
  constructor() {
    super();
    this.templateCache = undefined; // saját példány, saját gyorsítótár (mustache.mjs Writer konstruktor)
  }
  #plainValue(token, context) {
    if (!(context instanceof OwnPropertyContext)) throw new Error('nem OwnPropertyContext');
    const r = context.resolve(token[1]);
    if (!r.found) throw new MissingNameError(token[1]);
    return toText(r.value);
  }
  escapedValue(token, context) {
    return this.#plainValue(token, context);
  }
  unescapedValue(token, context) {
    return this.#plainValue(token, context);
  }
}
const strictWriter = new StrictWriter();
export function renderStrictPath(template, view) {
  try {
    return {
      ok: true,
      value: strictWriter.render(template, new OwnPropertyContext(view, undefined), undefined, undefined),
    };
  } catch (e) {
    return {
      ok: false,
      error: String(e && e.message),
      missingName: e instanceof MissingNameError ? e.missingName : undefined,
    };
  }
}
export { strictWriter };

// A könyvtár gyári útja (a research 7. felállása): sima nézet, csak config.escape.
export function renderStock(template, view, escape = toText) {
  try {
    return { ok: true, value: Mustache.render(template, view, undefined, { escape }) };
  } catch (e) {
    return { ok: false, error: String(e && e.message) };
  }
}
