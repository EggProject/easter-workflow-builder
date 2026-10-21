import Mustache from 'mustache';
import { StrictWriter, strictWriter } from './lib.mjs';
const t = 'Szia {{input.tema}} {{#input.elemek}}{{.}}{{/input.elemek}}';
const before = Mustache.templateCache;
console.log('alapból templateCache típusa:', typeof before, 'kulcsok:', Object.keys(before._cache).length);
const a1 = Mustache.parse(t),
  a2 = Mustache.parse(t);
console.log(
  'cache BE: parse(t) === parse(t):',
  a1 === a2,
  ' cache kulcsok:',
  JSON.stringify(Object.keys(before._cache)),
);
Mustache.templateCache = undefined;
console.log('beállítás után Mustache.templateCache:', Mustache.templateCache);
const b1 = Mustache.parse(t),
  b2 = Mustache.parse(t);
console.log(
  'cache KI: parse(t) === parse(t):',
  b1 === b2,
  ' tokenek egyenlők tartalomra:',
  JSON.stringify(b1) === JSON.stringify(b2),
);
Mustache.render('{{x}}', { x: 1 });
console.log('render után Mustache.templateCache:', Mustache.templateCache);
console.log('a régi gyorsítótár objektum kulcsai (nem nő tovább):', Object.keys(before._cache).length);
// Writer példány saját gyorsítótára
const plain = new Mustache.Writer();
plain.parse(t);
plain.parse('{{y}}');
console.log(
  'új Mustache.Writer példány templateCache kulcsai (a globális kikapcsolás NEM hat rá):',
  Object.keys(plain.templateCache._cache).length,
);
console.log(
  'StrictWriter példány templateCache:',
  strictWriter.templateCache,
  ' new StrictWriter():',
  new StrictWriter().templateCache,
);
const s1 = strictWriter.parse(t),
  s2 = strictWriter.parse(t);
console.log('StrictWriter parse(t) === parse(t):', s1 === s2);
