// Használat: node p8-run.mjs <stock|spec|strict> <listener|nolistener> <traps|notraps>
import { baseRunContext, renderSpecPath, renderStrictPath, renderStock } from './lib.mjs';
import Mustache from 'mustache';
Mustache.templateCache = undefined;
const [mode, listenerMode, trapMode] = process.argv.slice(2);
let rejections = 0;
if (listenerMode === 'listener')
  process.on('unhandledRejection', (reason) => {
    rejections++;
    console.log('UNHANDLED_REJECTION:', String(reason));
  });

export const attacks = [
  '{{toString}}',
  '{{constructor}}',
  '{{input.constructor.name}}',
  '{{input.constructor.constructor.name}}',
  '{{#constructor}}x{{/constructor}}',
  '{{input.__proto__}}',
  '{{input.tema.constructor.name}}',
  '{{steps.x.map}}',
  '{{input.items.constructor.fromAsync}}',
  // bővítés
  '{{#input.items.constructor.fromAsync}}x{{/input.items.constructor.fromAsync}}',
  '{{input.items.map}}',
  '{{#input.items.map}}x{{/input.items.map}}',
  '{{{input.constructor}}}',
  '{{& input.toString}}',
  '{{input.hasOwnProperty}}',
  '{{input.valueOf}}',
  '{{input.__proto__.constructor.name}}',
  '{{#input.constructor.constructor}}return 1{{/input.constructor.constructor}}',
  '{{#input}}{{constructor.name}}{{/input}}',
  '{{#input.items}}{{constructor.name}}{{/input.items}}',
  '{{#input.items}}{{length}}{{/input.items}}',
  '{{#input.tema}}{{length}}{{/input.tema}}',
  '{{steps.node-1.constructor.name}}',
  '{{item.constructor}}',
  '{{input.trapFn}}',
  '{{#input.trapFn}}x{{/input.trapFn}}',
  '{{{input.trapFn}}}',
  '{{#input.szerzo}}{{toString}}{{valueOf}}{{/input.szerzo}}',
  '{{input.items.constructor.from}}',
  '{{input.constructor.keys}}',
];

const view = baseRunContext();
let trapCalls = [];
let armed = false;
if (trapMode === 'traps') {
  // Csapda függvény a nézetben, saját tulajdonságként (a RunContext adata ezt nem tartalmazhatja, itt csak csapda).
  view.input.trapFn = function trapFn() {
    if (armed) trapCalls.push('input.trapFn');
    return 'TRAP';
  };
  const targets = [
    [Array, 'fromAsync', 'Array.fromAsync'],
    [Array, 'from', 'Array.from'],
    [Array.prototype, 'map', 'Array.prototype.map'],
    [Array.prototype, 'toString', 'Array.prototype.toString'],
    [Object.prototype, 'toString', 'Object.prototype.toString'],
    [Object.prototype, 'valueOf', 'Object.prototype.valueOf'],
    [Object.prototype, 'hasOwnProperty', 'Object.prototype.hasOwnProperty'],
    [Object, 'keys', 'Object.keys'],
    [String.prototype, 'toString', 'String.prototype.toString'],
    [String.prototype, 'valueOf', 'String.prototype.valueOf'],
  ];
  for (const [owner, key, label] of targets) {
    const original = owner[key];
    Object.defineProperty(owner, key, {
      configurable: true,
      writable: true,
      enumerable: false,
      value: {
        [key](...args) {
          if (armed) trapCalls.push(label);
          return original.apply(this, args);
        },
      }[key],
    });
  }
}
const render = mode === 'stock' ? renderStock : mode === 'spec' ? renderSpecPath : renderStrictPath;
const results = [];
for (const t of attacks) {
  trapCalls = [];
  armed = true;
  const r = render(t, view);
  armed = false;
  results.push({ t, out: r.ok ? JSON.stringify(r.value) : 'HIBA: ' + r.error, calls: [...trapCalls] });
}
for (const r of results)
  console.log(`${r.t.padEnd(78)} -> ${r.out}${r.calls.length ? '   HÍVOTT: ' + r.calls.join(',') : ''}`);
const totalCalls = results.reduce((n, r) => n + r.calls.length, 0);
await new Promise((res) => setTimeout(res, 300));
console.log(
  `ÖSSZESEN: mód=${mode} figyelő=${listenerMode} csapdák=${trapMode} függvényhívás=${totalCalls} kezeletlen_elutasítás=${rejections}`,
);
