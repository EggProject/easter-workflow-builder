// T-010-4 kiegészítés: a motor által a loop saját continueExpression-jének átadott
// kontextus a SPEC-010 7.1 környezetben és a 7.3 leképezéssel (undefined -> null).
import { Environment } from '/sessions/vigilant-clever-mendel/meres/t010-2/node_modules/@marcbachmann/cel-js/lib/index.js';
const env = new Environment();
for (const name of ['input', 'steps', 'item', 'itemIndex', 'iteration', 'joinInputs', 'error'])
  env.registerVariable(name, 'dyn');
// A mért kontextus (A eset, mindhárom loop kiértékelés), a 7.3 leképezés után:
const loopOwn = {
  input: { tema: 'x' },
  steps: { start: { tema: 'x' } },
  item: null,
  itemIndex: null,
  iteration: null,
  joinInputs: null,
  error: null,
};
// A törzs (torzs) sablonjánál mért iteration 0 és 1, CEL int alakban:
const body1 = { ...loopOwn, steps: { lp: null, start: { tema: 'x' } }, iteration: 1n };
const cases = [
  ['loop saját', 'iteration < 3', loopOwn],
  ['loop saját', 'iteration < 2', loopOwn],
  ['loop saját', 'iteration == null', loopOwn],
  ['loop saját', 'iteration != null && iteration < 2', loopOwn],
  ['loop saját', 'has(steps.torzs)', loopOwn],
  ['loop saját', 'steps["ellenorzes"].kesz == false', loopOwn],
  ['loop saját', 'false', loopOwn],
  ['törzs (iteration=1n)', 'iteration < 3', body1],
];
for (const [where, expr, ctx] of cases) {
  let out;
  try {
    const v = env.evaluate(expr, ctx);
    out = `OK ${typeof v} ${String(v)}`;
  } catch (e) {
    out = `HIBA ${e?.constructor?.name}: ${String(e?.message).split('\n')[0]}`;
  }
  console.log(`${where} | ${expr} | ${out}`);
}
