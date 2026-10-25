// Kerülő út próba: a sima objektumok mély átalakítása Map példánnyá a CEL felé.
import { Environment } from '@marcbachmann/cel-js';
import { inspect } from 'node:util';
const env = new Environment();
for (const n of ['input', 'steps']) env.registerVariable(n, 'dyn');
const toMap = (v) =>
  Array.isArray(v)
    ? v.map(toMap)
    : v !== null && typeof v === 'object'
      ? new Map(Object.entries(v).map(([k, x]) => [k, toMap(x)]))
      : v;
const input = toMap(
  JSON.parse('{"tema":"x","constructor":"saját","l":[{"n":1,"aktiv":true},{"n":2,"constructor":"z","aktiv":false}]}'),
);
for (const e of [
  'input.tema',
  'input.constructor',
  'has(input.constructor)',
  'has(input.nincs)',
  'input.nincs',
  'input.l.filter(e, e.n > 1.0).size()',
  'input.l.filter(e, e.aktiv).map(e, e.n)',
  'input.toString',
  'input',
  '{"a": 1}',
]) {
  try {
    const v = env.evaluate(e, { input, steps: new Map() });
    console.log(`${e} => ${inspect(v)} | ${v instanceof Map ? 'Map' : Array.isArray(v) ? 'Array' : typeof v}`);
  } catch (err) {
    console.log(`${e} => ${err.name} ${err.code}: ${err.summary}`);
  }
}
