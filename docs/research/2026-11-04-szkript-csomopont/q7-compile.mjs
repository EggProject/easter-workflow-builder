// Q-7: fordítás futtatás nélkül (evalCode compileOnly), az async törzs csomagolásának
// szintaktikai hibája, és a csomagolásból kitörő törzs viselkedése két csomagolási módon.
import { loadModule, log } from './common.mjs';
const QuickJS = await loadModule();
const runtime = QuickJS.newRuntime();
const context = runtime.newContext();
const zero = context.newNumber(0);
context.setProp(context.global, 'sideEffect', zero);
zero.dispose();
const describe = (result) => {
  if (result.error) {
    const e = context.dump(result.error);
    result.error.dispose();
    return `hiba ${e?.name}: ${e?.message}`;
  }
  const type = context.typeof(result.value);
  result.value.dispose();
  return `siker (typeof ${type})`;
};
const wrap = (source) => `(async () => {\n${source}\n})()`;
const sources = {
  'helyes törzs': 'const x = await Promise.resolve(input); return { y: 1 };',
  'szintaktikai hiba': 'return {',
  'await a törzsben': 'return await 1;',
  'kitörés a csomagolásból': '}); sideEffect = 1; (async () => {',
  'mellékhatás a törzsben': 'sideEffect = 2; return 1;',
};
const compile = {};
for (const [name, source] of Object.entries(sources)) {
  compile[name] = describe(context.evalCode(wrap(source), 'script.js', { compileOnly: true }));
}
const readSideEffect = () => {
  const h = context.getProp(context.global, 'sideEffect');
  const v = context.dump(h);
  h.dispose();
  return v;
};
const sideEffectAfterCompile = readSideEffect();
// Második csomagolási mód: az AsyncFunction konstruktor a törzset külön elemzi-e.
const ctor = {};
for (const [name, source] of Object.entries(sources)) {
  const src = context.newString(source);
  context.setProp(context.global, '__src', src);
  src.dispose();
  ctor[name] = describe(
    context.evalCode('Object.getPrototypeOf(async function () {}).constructor(__src)', 'ctor.js', {
      compileOnly: false,
    }),
  );
}
const sideEffectAfterCtor = readSideEffect();
// A szintaktikai hiba helye: a sor szám a csomagolt szövegben.
const err = context.evalCode(wrap('let a = 1;\nreturn {'), 'script.js', { compileOnly: true });
const errDump = context.dump(err.error);
err.error.dispose();
log('Q-7', {
  compileOnly: compile,
  sideEffectAfterCompile,
  asyncFunctionCtor: ctor,
  sideEffectAfterCtor,
  syntaxErrorDetail: { name: errDump.name, message: errDump.message, stack: errDump.stack },
});
context.dispose();
runtime.dispose();
