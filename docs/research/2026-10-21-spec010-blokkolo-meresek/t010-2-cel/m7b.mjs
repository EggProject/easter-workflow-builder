import { Environment } from '@marcbachmann/cel-js';
import { inspect } from 'node:util';
const env = new Environment();
for (const n of ['input', 'steps', 'item']) env.registerVariable(n, 'dyn');
const J = (s) => JSON.parse(s);
const cases = [
  [
    'csak "constructor" saját kulcs, input.tema',
    { input: J('{"tema":"x","constructor":"saját"}'), steps: {}, item: null },
    'input.tema',
  ],
  [
    'csak "constructor", has(input.tema)',
    { input: J('{"tema":"x","constructor":"saját"}'), steps: {}, item: null },
    'has(input.tema)',
  ],
  [
    'csak "constructor", input.constructor',
    { input: J('{"tema":"x","constructor":"saját"}'), steps: {}, item: null },
    'input.constructor',
  ],
  [
    '"constructor" objektum értékkel',
    { input: J('{"tema":"x","constructor":{"a":1}}'), steps: {}, item: null },
    'input.tema',
  ],
  [
    'csak "__proto__" saját kulcs (JSON.parse)',
    { input: J('{"tema":"x","__proto__":"saját"}'), steps: {}, item: null },
    'input["__proto__"]',
  ],
  [
    'csak "__proto__", input.tema',
    { input: J('{"tema":"x","__proto__":"saját"}'), steps: {}, item: null },
    'input.tema',
  ],
  [
    'csak "toString" saját kulcs',
    { input: J('{"tema":"x","toString":"saját"}'), steps: {}, item: null },
    'input.toString',
  ],
  [
    'csak "hasOwnProperty" saját kulcs',
    { input: J('{"tema":"x","hasOwnProperty":"saját"}'), steps: {}, item: null },
    'input.hasOwnProperty',
  ],
  [
    'másik lépés kimenetében "constructor", érintetlen ág',
    { input: { tema: 'x' }, steps: { a: { x: 1 }, b: J('{"constructor":"y"}') }, item: null },
    'steps["a"].x',
  ],
  [
    'másik lépés kimenetében "constructor", steps.size()',
    { input: { tema: 'x' }, steps: { a: { x: 1 }, b: J('{"constructor":"y"}') }, item: null },
    'size(steps)',
  ],
  [
    'listában elem "constructor" kulccsal, filter',
    { input: { l: [{ n: 1 }, J('{"n":2,"constructor":"z"}')] }, steps: {}, item: null },
    'input.l.filter(e, e.n > 1.0).size()',
  ],
  [
    'null prototípusú objektum',
    { input: Object.assign(Object.create(null), { tema: 'x' }), steps: {}, item: null },
    'input.tema',
  ],
  [
    'null prototípusú objektum az eredményben',
    { input: Object.assign(Object.create(null), { tema: 'x' }), steps: {}, item: null },
    'input',
  ],
];
for (const [k, ctx, e] of cases) {
  try {
    const v = env.evaluate(e, ctx);
    console.log(`${k} | ${e} => ${inspect(v)}`);
  } catch (err) {
    console.log(`${k} | ${e} => ${err.name} ${err.code}: ${err.summary}`);
  }
}
