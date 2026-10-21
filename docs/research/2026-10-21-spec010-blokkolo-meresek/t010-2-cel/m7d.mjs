import { Environment } from '@marcbachmann/cel-js';
import { inspect } from 'node:util';
const env = new Environment();
for (const e of [
  '{"constructor": 1, "a": 2}',
  '{"__proto__": 1, "a": 2}',
  '{"prototype": 1, "a": 2}',
  '{"constructor": 1}.size()',
  'size({"constructor": 1, "a": 2})',
]) {
  try {
    console.log(e, '=>', inspect(env.evaluate(e)));
  } catch (err) {
    console.log(e, '=>', err.name, err.code, err.summary);
  }
}
