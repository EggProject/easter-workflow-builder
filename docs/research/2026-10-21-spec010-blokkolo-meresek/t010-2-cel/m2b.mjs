import { Environment } from '@marcbachmann/cel-js';
const env = new Environment().registerVariable('input', 'dyn');
for (const e of [
  '-'.repeat(300) + '1',
  '-'.repeat(301) + '1',
  '!'.repeat(300) + 'true',
  '-'.repeat(300) + 'input',
  '-('.repeat(260) + '1' + ')'.repeat(260),
  'input' + '.a'.repeat(300),
  '1' + ' + 1'.repeat(300),
]) {
  try {
    const p = env.parse(e);
    let d = 0,
      n = p.ast;
    while (n && n.args) {
      d++;
      n = Array.isArray(n.args) ? n.args[0] : n.args;
    }
    console.log(
      JSON.stringify(e.slice(0, 12)),
      e.length,
      'parse ok, op:',
      p.ast.op,
      'chain depth approx',
      d,
      'eval:',
      String(p({ input: {} })),
    );
  } catch (err) {
    console.log(JSON.stringify(e.slice(0, 12)), e.length, err.name, err.code, err.summary);
  }
}
