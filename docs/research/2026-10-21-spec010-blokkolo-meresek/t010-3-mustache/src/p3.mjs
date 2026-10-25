import Mustache from 'mustache';
import {
  baseRunContext,
  renderSpecPath,
  renderStrictPath,
  OwnPropertyContext,
  lookupLog,
  setLogLookups,
  toText,
} from './lib.mjs';
const ctx = baseRunContext();
const fmt = (r) => (r.ok ? JSON.stringify(r.value) : 'HIBA: ' + r.error);

console.log('--- A) a lookup hívás argumentumai a Mustache.render úton (SPEC 6.2 szó szerinti út) ---');
setLogLookups(true);
for (const t of [
  '{{nemletezik}}',
  '{{{nemletezik}}}',
  '{{& nemletezik}}',
  '{{#nemletezik}}x{{/nemletezik}}',
  '{{^nemletezik}}y{{/nemletezik}}',
]) {
  lookupLog.length = 0;
  const r = renderSpecPath(t, ctx);
  console.log(
    t.padEnd(34),
    'kimenet=' + fmt(r),
    'lookup hívások=' + JSON.stringify(lookupLog.map((l) => ({ arg: l.name, hivo: l.caller }))),
  );
}
setLogLookups(false);

console.log('--- A2) a lookup paraméterlistája (Function.length) ---');
console.log('Mustache.Context.prototype.lookup.length =', Mustache.Context.prototype.lookup.length);

console.log('--- B) Writer alosztály út: sima változó tag hiba, szakasz alapértelmezett ---');
const cases = [
  '{{nemletezik}}',
  '{{{nemletezik}}}',
  '{{& nemletezik}}',
  '{{input.nemletezik}}',
  '{{input.szerzo.nemletezik}}',
  '{{item}}',
  '{{itemIndex}}',
  '{{error.kind}}',
  '{{#nemletezik}}x{{/nemletezik}}',
  '{{^nemletezik}}y{{/nemletezik}}',
  '{{#input.nemletezik}}x{{/input.nemletezik}}',
  '{{^input.nemletezik}}y{{/input.nemletezik}}',
  '{{#item}}x{{/item}}',
  '{{^item}}nincs elem{{/item}}',
  'a{{input.semmi}}b',
  '{{#input.elemek}}{{nincs}}{{/input.elemek}}',
  '{{#input.elemek}}{{input.tema}}|{{/input.elemek}}',
];
for (const t of cases) {
  const r = renderStrictPath(t, ctx);
  console.log(t.padEnd(52), fmt(r), r.missingName !== undefined ? 'missingName=' + r.missingName : '');
}

console.log('--- C) ugyanez a Mustache.render úton (Context alosztály egyedül) ---');
for (const t of cases) console.log(t.padEnd(52), fmt(renderSpecPath(t, ctx)));

console.log('--- D) stack alapú megkülönböztetés próbája a Context-en belül (csak bizonyításként) ---');
class StackContext extends OwnPropertyContext {
  push(view) {
    return new StackContext(view, this);
  }
  lookup(name) {
    const caller = (new Error().stack.split('\n')[2] || '').trim();
    const r = this.resolve(name);
    if (!r.found && /escapedValue|unescapedValue/.test(caller))
      throw new Error('hiányzó név: ' + name + ' (hívó: ' + caller + ')');
    return r.found ? r.value : undefined;
  }
}
for (const t of [
  '{{nemletezik}}',
  '{{& nemletezik}}',
  '{{#nemletezik}}x{{/nemletezik}}',
  '{{^nemletezik}}y{{/nemletezik}}',
]) {
  try {
    console.log(
      t.padEnd(34),
      JSON.stringify(Mustache.render(t, new StackContext(ctx, undefined), undefined, { escape: toText })),
    );
  } catch (e) {
    console.log(t.padEnd(34), 'HIBA: ' + e.message);
  }
}
