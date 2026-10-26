// Megvalósítás nélküli regressziós teszt (SPEC-002 6.2 5. pont mintája): a titok tilalmat
// őrzi (SPEC-010 5.2, 16. szekció 28.). Egy titkot tartalmazó env változó mellett sem a
// sablon, sem a kifejezés nem adhat olyan kimenetet, ami a titok értékét tartalmazza, a
// `process`, `process.env` és `globalThis` nevekre hivatkozva sem, és a hibaszövegbe sem
// kerülhet. A teszt a valódi `mustache` és `@marcbachmann/cel-js` könyvtáron fut, mock nélkül.
// Az érték csak tesztjelölő, nem valódi titok.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createCelExpressionEvaluator } from '../cel-expression/create-cel-expression-evaluator.ts';
import { createMustacheTemplateRenderer } from '../mustache-template/create-mustache-template-renderer.ts';

const SECRET_ENV_NAME = 'WORKFLOW_LANGUAGE_TEST_SECRET';
const SECRET_VALUE = 'titok-jelolo-7c1f4e2a9b6d';

/**
 * Valós alakú `RunContext`, a hét deklarált kulccsal. Env érték nincs benne (SPEC-010 5.2).
 */
const RUN_CONTEXT: Readonly<Record<string, unknown>> = {
  input: { marker: 'bemenet-jelolo', items: ['a', 'b'] },
  steps: { 'node-1': { summary: 'kesz' } },
  item: undefined,
  itemIndex: undefined,
  iteration: undefined,
  joinInputs: undefined,
  error: undefined,
};

/**
 * A `process`, `process.env` és `globalThis` nevekre, valamint az ezeken át a titokig vezető
 * láncokra hivatkozó sablonok. A beágyazott szakasz alak is szerepel, mert a szakasz a nevet
 * hatókörként oldja fel.
 */
const TEMPLATES: readonly string[] = [
  '{{process}}',
  '{{process.env}}',
  `{{process.env.${SECRET_ENV_NAME}}}`,
  `{{{process.env.${SECRET_ENV_NAME}}}}`,
  `{{& process.env.${SECRET_ENV_NAME}}}`,
  `{{#process}}{{env.${SECRET_ENV_NAME}}}{{/process}}`,
  `{{#process.env}}{{${SECRET_ENV_NAME}}}{{/process.env}}`,
  `{{^process}}{{process.env.${SECRET_ENV_NAME}}}{{/process}}`,
  '{{globalThis}}',
  `{{globalThis.process.env.${SECRET_ENV_NAME}}}`,
  `{{#globalThis}}{{process.env.${SECRET_ENV_NAME}}}{{/globalThis}}`,
  `{{input.constructor.constructor.name}}{{input.__proto__.process.env.${SECRET_ENV_NAME}}}`,
  `{{constructor.constructor.name}}{{__proto__.process.env.${SECRET_ENV_NAME}}}`,
  `{{.}}{{process.env.${SECRET_ENV_NAME}}}`,
  `{{steps.process.env.${SECRET_ENV_NAME}}}`,
  `{{input.process.env.${SECRET_ENV_NAME}}}`,
];

/**
 * A ugyanezekre hivatkozó CEL kifejezések: közvetlen név, map index, `has()` makró, függvényhívás
 * és a `constructor` lánc.
 */
const EXPRESSIONS: readonly string[] = [
  'process',
  'process.env',
  `process.env.${SECRET_ENV_NAME}`,
  `process.env["${SECRET_ENV_NAME}"]`,
  `has(process.env.${SECRET_ENV_NAME})`,
  `string(process.env.${SECRET_ENV_NAME})`,
  'globalThis',
  `globalThis.process.env.${SECRET_ENV_NAME}`,
  `input.process.env.${SECRET_ENV_NAME}`,
  `steps.process.env.${SECRET_ENV_NAME}`,
  `input.constructor.constructor("return process.env.${SECRET_ENV_NAME}")()`,
  `input.__proto__.process.env.${SECRET_ENV_NAME}`,
  `input["constructor"]["constructor"]("return process.env.${SECRET_ENV_NAME}")()`,
  `[process, globalThis, process.env].size()`,
  `{"k": process.env.${SECRET_ENV_NAME}}`,
  `"x" + process.env.${SECRET_ENV_NAME}`,
];

/**
 * A teljes eredmény (siker érték és hibaüzenet) szöveges alakja: a titok sehol nem szerepelhet.
 */
function serialize(outcome: unknown): string {
  return JSON.stringify(outcome, (_key, value: unknown) => (typeof value === 'bigint' ? value.toString() : value));
}

describe('a titok tilalom (SPEC-010 5.2, 16. szekció 28.)', () => {
  const renderer = createMustacheTemplateRenderer();
  const evaluator = createCelExpressionEvaluator();

  beforeAll(() => {
    vi.stubEnv(SECRET_ENV_NAME, SECRET_VALUE);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('a titok tényleg az env változóban van (a teszt nem üres)', () => {
    expect(process.env[SECRET_ENV_NAME]).toBe(SECRET_VALUE);
  });

  it('pozitív kontroll: a kontextusban átadott érték megjelenik, tehát a kimenet vizsgálata érzékeny', () => {
    expect(renderer.render('{{input.marker}}', RUN_CONTEXT)).toStrictEqual({ kind: 'ok', value: 'bemenet-jelolo' });
    expect(evaluator.evaluate('input.marker', RUN_CONTEXT)).toStrictEqual({ kind: 'ok', value: 'bemenet-jelolo' });
  });

  it.each(TEMPLATES)('a sablon nem ad a titkot tartalmazó kimenetet vagy hibaszöveget: %s', (template) => {
    const compiled = renderer.compile(template);
    const rendered = renderer.render(template, RUN_CONTEXT);
    expect(serialize(compiled)).not.toContain(SECRET_VALUE);
    expect(serialize(rendered)).not.toContain(SECRET_VALUE);
  });

  it.each(EXPRESSIONS)('a kifejezés nem ad a titkot tartalmazó kimenetet vagy hibaszöveget: %s', (expression) => {
    const compiled = evaluator.compile(expression);
    const evaluated = evaluator.evaluate(expression, RUN_CONTEXT);
    expect(serialize(compiled)).not.toContain(SECRET_VALUE);
    expect(serialize(evaluated)).not.toContain(SECRET_VALUE);
  });

  it('a process, process.env és globalThis névre hivatkozó sima változó tag hibaágat ad, mert a név nincs a kontextusban', () => {
    for (const template of ['{{process}}', '{{process.env}}', '{{globalThis}}']) {
      expect(renderer.render(template, RUN_CONTEXT).kind, template).toBe('error');
    }
  });

  it('a process, process.env és globalThis névre hivatkozó kifejezés hibaágat ad, mert a változó nincs deklarálva', () => {
    for (const expression of ['process', 'process.env', `process.env.${SECRET_ENV_NAME}`, 'globalThis']) {
      expect(evaluator.evaluate(expression, RUN_CONTEXT).kind, expression).toBe('error');
    }
  });
});
