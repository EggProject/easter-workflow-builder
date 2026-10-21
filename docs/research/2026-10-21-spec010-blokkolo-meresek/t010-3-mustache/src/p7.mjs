import Mustache from 'mustache';
import { baseRunContext, renderSpecPath, renderStrictPath, renderStock, OwnPropertyContext, toText } from './lib.mjs';
Mustache.templateCache = undefined;
const fmt = (r) => (r.ok ? JSON.stringify(r.value) : 'HIBA: ' + r.error);
const base = baseRunContext();
const fan = baseRunContext({ item: JSON.parse('{"nev":"elem-1","tagok":["p","q"]}'), itemIndex: 0 });
const loop = baseRunContext({ iteration: 2 });
const join = baseRunContext({ joinInputs: JSON.parse('[{"r":"A"},{"r":"B"}]') });
const err = baseRunContext({ error: { kind: 'agent_failed', message: 'hiba <x>' } });
const emptyElemek = baseRunContext();
emptyElemek.input.elemek = [];
const missingElemek = baseRunContext();
delete missingElemek.input.elemek;

const rows = [
  ['6.4/1 pontozott név', '{{input.tema}}', base],
  ['6.4/2 szakasz tömbön', '{{#input.elemek}}- {{.}}{{/input.elemek}}', base],
  ['6.4/3 fordított szakasz, nem üres tömb', '{{^input.elemek}}nincs{{/input.elemek}}', base],
  ['6.4/3 fordított szakasz, üres tömb', '{{^input.elemek}}nincs{{/input.elemek}}', emptyElemek],
  ['6.4/3 fordított szakasz, hiányzó', '{{^input.elemek}}nincs{{/input.elemek}}', missingElemek],
  ['6.4/3 szakasz, hiányzó', '{{#input.elemek}}- {{.}}{{/input.elemek}}', missingElemek],
  ['6.4/4 partial', '{{> név}}', base],
  ['6.4/5 határoló csere', '{{=<% %>=}}<% input.tema %>|<%#input.elemek%><%.%><%/input.elemek%>', base],
  [
    'beágyazott szakasz',
    '{{#input.csoportok}}{{nev}}:[{{#tagok}}{{.}},{{/tagok}}{{^tagok}}ures{{/tagok}}];{{/input.csoportok}}',
    base,
  ],
  ['szakasz objektumon', '{{#input.szerzo}}{{nev}}/{{kor}}{{/input.szerzo}}', base],
  ['szülő kontextus bejárás szakaszban', '{{#input.elemek}}{{.}}={{input.szam}};{{/input.elemek}}', base],
  ['pontozott név szakaszban, szülőből', '{{#input.csoportok}}{{nev}}-{{input.szerzo.nev}};{{/input.csoportok}}', base],
  ['mély pontozott név', '{{input.beagyazott.a.b.c}}', base],
  ['. név a gyökéren (objektum)', '{{#input.szerzo}}{{.}}{{/input.szerzo}}', base],
  ['szakasz szövegen', '{{#input.tema}}[{{.}}]{{/input.tema}}', base],
  ['szakasz számon', '{{#input.szam}}[{{.}}]{{/input.szam}}', base],
  [
    'szakasz igaz/hamis',
    '{{#input.igaz}}I{{/input.igaz}}{{#input.hamis}}H{{/input.hamis}}{{^input.hamis}}nemH{{/input.hamis}}',
    base,
  ],
  [
    'szakasz null/0/üres szöveg',
    '{{#input.semmi}}a{{/input.semmi}}{{^input.semmi}}N{{/input.semmi}}{{#input.nulla}}b{{/input.nulla}}{{^input.nulla}}Z{{/input.nulla}}{{^input.szoveg_ures}}E{{/input.szoveg_ures}}',
    base,
  ],
  ['steps hivatkozás', '{{steps.node-1.summary}} {{#steps.node-1.tags}}{{.}} {{/steps.node-1.tags}}', base],
  ['steps teljes objektum', '{{steps.node-1}}', base],
  ['tömb index pontozva', '{{input.elemek.0}}{{input.elemek.1}}', base],
  ['tömb length (saját adat tulajdonság)', '{{input.elemek.length}}', base],
  ['szöveg length (primitív tulajdonság)', '{{input.tema.length}}', base],
  ['fan_out item és itemIndex', '{{item.nev}}#{{itemIndex}} {{#item.tagok}}{{.}}{{/item.tagok}}', fan],
  ['fan_out item szakasz', '{{#item}}{{nev}}{{/item}}', fan],
  ['loop iteration', 'kör {{iteration}}', loop],
  ['joinInputs', '{{#joinInputs}}{{r}};{{/joinInputs}}', join],
  ['error', '{{error.kind}}: {{error.message}}', err],
  ['hiányzó item nem fan_out-ban, szakasz', '{{#item}}x{{/item}}{{^item}}nincs{{/item}}', base],
];
let diffs = 0;
for (const [label, t, view] of rows) {
  const stock = renderStock(t, view),
    spec = renderSpecPath(t, view),
    strict = renderStrictPath(t, view);
  const same = fmt(stock) === fmt(spec) && fmt(spec) === fmt(strict);
  if (!same) diffs++;
  console.log(
    `${same ? 'AZONOS ' : 'ELTÉR  '} ${label}\n    sablon=${JSON.stringify(t)}\n    stock=${fmt(stock)}\n    spec  =${fmt(spec)}\n    strict=${fmt(strict)}`,
  );
}
console.log('eltérő sorok száma:', diffs);

console.log('--- push felülírás: minden szakasz belsejében OwnPropertyContext áll ---');
const seen = [];
class Probe extends OwnPropertyContext {
  push(v) {
    return new Probe(v, this);
  }
  lookup(n) {
    seen.push([n, this.constructor.name, this instanceof OwnPropertyContext]);
    return super.lookup(n);
  }
}
Mustache.render(
  '{{#input.csoportok}}{{#tagok}}{{.}}{{/tagok}}{{nev}}{{/input.csoportok}}',
  new Probe(base, undefined),
  undefined,
  { escape: toText },
);
console.log(JSON.stringify(seen));
console.log('--- push felülírás NÉLKÜL (ellenpróba): a szakasz belseje alap Context, a szűkítés elvész ---');
class NoPush extends Mustache.Context {
  lookup(n) {
    return OwnPropertyContext.prototype.resolve.call(this, n).found
      ? OwnPropertyContext.prototype.resolve.call(this, n).value
      : undefined;
  }
}
class NoPushOwn extends OwnPropertyContext {}
NoPushOwn.prototype.push = Mustache.Context.prototype.push;
for (const t of [
  '{{#input.elemek}}{{constructor.name}}{{/input.elemek}}',
  '{{#input.szerzo}}{{constructor.name}}|{{toString}}{{/input.szerzo}}',
]) {
  console.log(
    JSON.stringify(t),
    'push nélkül=',
    JSON.stringify(Mustache.render(t, new NoPushOwn(base, undefined), undefined, { escape: toText })),
    ' push-sal=',
    fmt(renderSpecPath(t, base)),
  );
}
