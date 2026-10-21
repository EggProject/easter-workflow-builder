// Kiegészítés a (8)-hoz: JOGOS nyers tag objektum/tömb értékre a SPEC 6.2 úton.
import { baseRunContext, renderSpecPath, renderStrictPath } from './lib.mjs';
const view = baseRunContext();
let calls = [],
  armed = false;
for (const [owner, key, label] of [
  [Object.prototype, 'toString', 'Object.prototype.toString'],
  [Object.prototype, 'valueOf', 'Object.prototype.valueOf'],
  [Array.prototype, 'toString', 'Array.prototype.toString'],
  [Array.prototype, 'join', 'Array.prototype.join'],
]) {
  const original = owner[key];
  Object.defineProperty(owner, key, {
    configurable: true,
    writable: true,
    enumerable: false,
    value: {
      [key](...a) {
        if (armed) calls.push(label);
        return original.apply(this, a);
      },
    }[key],
  });
}
for (const t of ['{{{input.szerzo}}}', '{{& input.elemek}}', '{{{steps.node-1}}}', '{{input.szerzo}}']) {
  for (const [name, fn] of [
    ['spec', renderSpecPath],
    ['strict', renderStrictPath],
  ]) {
    calls = [];
    armed = true;
    const r = fn(t, view);
    armed = false;
    console.log(
      `${name.padEnd(6)} ${t.padEnd(20)} -> ${JSON.stringify(r.ok ? r.value : r.error)}  HÍVOTT: ${calls.join(',') || '-'}`,
    );
  }
}
