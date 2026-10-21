import { baseRunContext, renderSpecPath, renderStrictPath, renderStock } from './lib.mjs';
const ctx = baseRunContext({
  input: {
    szam: 42,
    tort: 0.5,
    nulla: 0,
    igaz: true,
    hamis: false,
    semmi: null,
    tomb: ['a', 1, null, { k: 'v' }],
    obj: { a: 1, b: { c: [1, 2], d: 'x"y' } },
    uresTomb: [],
    uresObj: {},
  },
});
const fmt = (r) => (r.ok ? JSON.stringify(r.value) : 'HIBA: ' + r.error);
for (const key of ['szam', 'tort', 'nulla', 'igaz', 'hamis', 'semmi', 'tomb', 'obj', 'uresTomb', 'uresObj']) {
  for (const t of [`{{input.${key}}}`, `{{{input.${key}}}}`, `{{& input.${key}}}`]) {
    console.log(
      `${t.padEnd(22)} spec=${fmt(renderSpecPath(t, ctx)).padEnd(40)} strict=${fmt(renderStrictPath(t, ctx)).padEnd(40)} stock=${fmt(renderStock(t, ctx))}`,
    );
  }
}
