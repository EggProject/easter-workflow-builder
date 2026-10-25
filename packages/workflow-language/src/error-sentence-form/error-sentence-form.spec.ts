// Megvalósítás nélküli regressziós teszt (SPEC-002 6.2 5. pont mintája): a csomag
// minden hibamondatának alakját őrzi. A szerkesztő (`apps/web` `toEditorSentence`)
// feltétel nélkül nagy kezdőbetűt és záró pontot tesz a mondatra (SPEC-010 10.,
// O-17), ezért a csomag vállalja: a `compile`, `evaluate` és `render` hibamondata
// nem üres, nem szóközzel kezdődik vagy zárul, és nem zárul ponttal.
import { readFileSync } from 'node:fs';
import { EvaluationError, ParseError } from '@marcbachmann/cel-js';
import { describe, expect, it } from 'vitest';
import { createCelExpressionEvaluator } from '../cel-expression/create-cel-expression-evaluator.ts';
import { describeCelError } from '../cel-expression/describe-cel-error.ts';
import { normalizeCelResult } from '../cel-expression/normalize-cel-result.ts';
import { createMustacheTemplateRenderer } from '../mustache-template/create-mustache-template-renderer.ts';
import { describeTemplateError } from '../mustache-template/describe-template-error.ts';

function expectEditorReadyForm(message: string): void {
  expect(message).not.toBe('');
  expect(message).toBe(message.trim());
  expect(message.endsWith('.')).toBe(false);
}

const CEL_SOURCE = readFileSync(new URL('../cel-expression/describe-cel-error.ts', import.meta.url), 'utf8');
const TABLE_BLOCK = CEL_SOURCE.slice(CEL_SOURCE.indexOf('new Map(['), CEL_SOURCE.indexOf(']);'));
const TABLE_CODES = TABLE_BLOCK.matchAll(/\[\s*'([a-z_]+)',\s*'/g)
  .map((match) => match[1] ?? '')
  .toArray();

describe('a hibamondatok alakja (SPEC-010 10., O-17)', () => {
  it('a CEL mondattábla minden kódja saját, pont nélküli mondatot ad, pozícióval és anélkül', () => {
    expect(TABLE_CODES.length).toBeGreaterThan(50);
    for (const code of TABLE_CODES) {
      for (const range of [{}, { range: { start: 3, end: 4 } }]) {
        const message = describeCelError(new ParseError({ code, message: 'x', ...range }));
        expect(message, code).not.toContain('(kód:');
        expectEditorReadyForm(message);
        expectEditorReadyForm(describeCelError(new EvaluationError({ code, message: 'x', ...range })));
      }
    }
  });

  it('a CEL tartalék mondatai (nem CEL kivétel, ismeretlen kód) pont nélküliek', () => {
    expectEditorReadyForm(describeCelError(new Error('x')));
    expectEditorReadyForm(describeCelError(new ParseError({ code: 'ismeretlen.', message: 'x' })));
    expectEditorReadyForm(
      describeCelError(new ParseError({ code: 'ismeretlen', message: 'x', range: { start: 1, end: 2 } })),
    );
  });

  it('az eredmény normalizálás három hibamondata pont nélküli', () => {
    class Pelda {
      readonly mezo = 1;
    }
    for (const value of [NaN, BigInt(Number.MAX_SAFE_INTEGER) + 2n, new Pelda()]) {
      const outcome = normalizeCelResult(value);
      expect(outcome.kind).toBe('error');
      if (outcome.kind === 'error') {
        expectEditorReadyForm(outcome.message);
      }
    }
  });

  it('a CEL compile és evaluate hibája pont nélküli', () => {
    const evaluator = createCelExpressionEvaluator();
    for (const expression of ['1 +', 'nincs', '1 / 0', '[1][5]', '"a" + 1']) {
      const compiled = evaluator.compile(expression);
      const evaluated = evaluator.evaluate(expression, {});
      for (const outcome of [compiled, evaluated]) {
        if (outcome.kind === 'error') {
          expectEditorReadyForm(outcome.message);
        }
      }
    }
    const failing = evaluator.evaluate('1 / 0', {});
    expect(failing.kind).toBe('error');
  });

  it('a sablon négy fordítási hibája, a tartalék és a név megnevező mondatok pont nélküliek', () => {
    for (const libraryMessage of [
      'Unclosed tag at 17',
      'Unopened section "x" at 2',
      'Unclosed section "x" at 36',
      'Invalid tags: x',
      'valami más',
    ]) {
      expectEditorReadyForm(describeTemplateError(new Error(libraryMessage)));
    }
    expectEditorReadyForm(describeTemplateError(undefined));
  });

  it('a sablon renderelés név megnevező hibája ponttal záruló névnél is pont nélküli', () => {
    const renderer = createMustacheTemplateRenderer();
    const context = { sima: 1, map: new Map<string, string>() };
    for (const template of [
      '{{a.}}',
      '{{a.b.}}',
      '{{&b.}}',
      '{{ x. }}',
      '{{.a}}',
      '{{map}}',
      '{{map.}}',
      '{{{map}}}',
    ]) {
      const outcome = renderer.render(template, context);
      expect(outcome.kind, template).toBe('error');
      if (outcome.kind === 'error') {
        expectEditorReadyForm(outcome.message);
      }
    }
    for (const template of ['{{#a}}', '{{/a}}', '{{=x=}}', '{{a']) {
      const outcome = renderer.compile(template);
      if (outcome.kind === 'error') {
        expectEditorReadyForm(outcome.message);
      }
    }
  });
});
