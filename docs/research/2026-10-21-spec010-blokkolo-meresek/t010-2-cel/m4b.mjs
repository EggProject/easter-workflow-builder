import { Environment } from '@marcbachmann/cel-js';
import { inspect } from 'node:util';
const env = new Environment().registerVariable('input', 'dyn');
const ctx = { input: { m: new Map([[1n, 'x']]) } };
for (const e of [
  '{1: "a"}[1]',
  '{1: "a"}["1"]',
  '{1: "a"}',
  '{dyn(1): "a", dyn("1"): "b"}',
  '{dyn(1): "a", dyn(1u): "b"}',
  '{dyn(1): "a", dyn(1.0): "b"}',
  '{1: "a"}.size()',
  'type({1: "a"})',
  '{1: "a"} == {"1": "a"}',
  '{"a": {2: "b"}}',
  '{1: "a"}.map(k, k)',
  '{1: "a"}.map(k, type(k))',
]) {
  try {
    const v = env.evaluate(e, ctx);
    console.log(
      e,
      '=>',
      inspect(v),
      '| proto:',
      v && typeof v === 'object' ? Object.getPrototypeOf(v)?.constructor?.name : '-',
      v instanceof Map ? '(Map)' : '',
    );
  } catch (err) {
    console.log(e, '=>', err.name, err.code, err.summary);
  }
}
