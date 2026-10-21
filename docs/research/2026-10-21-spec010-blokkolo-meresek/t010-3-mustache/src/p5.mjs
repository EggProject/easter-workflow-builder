import { baseRunContext, renderSpecPath, renderStrictPath, renderStock } from './lib.mjs';
const ctx = baseRunContext();
const fmt = (r) => (r.ok ? JSON.stringify(r.value) : 'HIBA: ' + r.error);
for (const t of ['{{> x}}', 'a{{>x}}b', '{{> ../../etc/passwd}}', '{{> input}}', '  {{> x}}\nsor']) {
  console.log(
    JSON.stringify(t).padEnd(28),
    'spec=' + fmt(renderSpecPath(t, ctx)),
    'strict=' + fmt(renderStrictPath(t, ctx)),
    'stock=' + fmt(renderStock(t, ctx)),
  );
}
