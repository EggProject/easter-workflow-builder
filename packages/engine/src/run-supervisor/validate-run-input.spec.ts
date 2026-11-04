/* eslint-disable unicorn/no-null -- a node configok nullázható mezői (SPEC-003 4.3) a tárolt alakban valódi `null` értéket hordoznak */
import { describe, expect, it } from 'vitest';
import type { Outcome } from '@easter-workflow-builder/core';
import { isRecord } from '@easter-workflow-builder/typeguards';
import type { ExecutableNodeConfig } from '../run-validation/executable-node-config.ts';
import { validateRunInput } from './validate-run-input.ts';

function startConfig(fields: readonly { readonly name: string; readonly required: boolean }[]): ExecutableNodeConfig {
  return {
    type: 'start',
    inputFields: fields.map((field) => ({
      name: field.name,
      label: field.name,
      valueKind: 'text',
      required: field.required,
    })),
    onUnhandledError: 'fail_run',
  };
}

type FieldSpec = Extract<ExecutableNodeConfig, { readonly type: 'start' }>['inputFields'][number];

function typedConfig(fields: readonly FieldSpec[]): ExecutableNodeConfig {
  return { type: 'start', inputFields: fields, onUnhandledError: 'fail_run' };
}

function plainField(valueKind: 'text' | 'number' | 'boolean' | 'list' | 'json', isRequired = false): FieldSpec {
  return { name: 'mezo', label: 'Mező', valueKind, required: isRequired };
}

function choiceField(isRequired = false): FieldSpec {
  return { name: 'mezo', label: 'Mező', valueKind: 'choice', options: ['piros', 'kek'], required: isRequired };
}

function runWith(field: FieldSpec, value: unknown): Outcome<void> {
  return validateRunInput(configsOf(typedConfig([field])), 'start', { mezo: value });
}

/**
 * A `JSON.parse` kimenete `Object.prototype` örökös objektum, ahogy a szerver
 * `z.record` kimenete is: pontosan az a bemenet, amiben egy örökölt tag látszik.
 */
function inputFromJson(text: string): Readonly<Record<string, unknown>> {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed)) {
    throw new Error('a teszt bemenete nem objektum');
  }
  return parsed;
}

function configsOf(config: ExecutableNodeConfig): ReadonlyMap<string, ExecutableNodeConfig> {
  return new Map([['start', config]]);
}

describe('validateRunInput', () => {
  it('minden kötelező mező jelen van: sikeres', () => {
    const configs = configsOf(
      startConfig([
        { name: 'tema', required: true },
        { name: 'megjegyzes', required: false },
      ]),
    );

    expect(validateRunInput(configs, 'start', { tema: 'x' })).toStrictEqual({ kind: 'ok', value: undefined });
  });

  it('hiányzó kötelező mező: missing_required_input, a mező nevével', () => {
    const configs = configsOf(startConfig([{ name: 'tema', required: true }]));

    const outcome = validateRunInput(configs, 'start', {});

    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('missing_required_input');
    expect(outcome.kind === 'error' ? outcome.message : '').toContain('tema');
  });

  it('a jelen lévő, de undefined értékű kulcs is hiányzó mezőnek számít', () => {
    const configs = configsOf(startConfig([{ name: 'tema', required: true }]));

    expect(validateRunInput(configs, 'start', { tema: undefined }).kind).toBe('error');
  });

  it('a nem kötelező mező hiánya nem hiba', () => {
    const configs = configsOf(startConfig([{ name: 'megjegyzes', required: false }]));

    expect(validateRunInput(configs, 'start', {}).kind).toBe('ok');
  });

  it('ismeretlen start node azonosítóra invalid_start_node', () => {
    const configs = configsOf(startConfig([]));

    const outcome = validateRunInput(configs, 'nincs-ilyen', {});

    expect(outcome.kind === 'error' ? outcome.message : '').toContain('invalid_start_node');
  });

  it('nem start típusú configra invalid_start_node', () => {
    const branch: ExecutableNodeConfig = {
      type: 'branch',
      expression: 'x',
      branches: [],
      defaultBranchKey: null,
      onUnhandledError: 'fail_run',
    };

    const outcome = validateRunInput(new Map([['start', branch]]), 'start', {});

    expect(outcome.kind === 'error' ? outcome.message : '').toContain('invalid_start_node');
  });

  describe('típus ellenőrzés (SPEC-016 5.5)', () => {
    it.each([
      { kind: 'text', value: 5, label: '5' },
      { kind: 'number', value: '5', label: '"5"' },
      { kind: 'number', value: NaN, label: 'NaN' },
      { kind: 'number', value: Infinity, label: 'Infinity' },
      { kind: 'boolean', value: 'true', label: '"true"' },
      { kind: 'list', value: 'a', label: '"a"' },
      { kind: 'list', value: ['a', 1], label: '["a", 1]' },
    ] as const)(
      'a(z) $kind mező hibás értékére ($label) invalid_input_type, a mező nevével és az elvárt típussal',
      ({ kind, value }) => {
        const outcome = runWith(plainField(kind), value);

        expect(outcome.kind).toBe('error');
        const message = outcome.kind === 'error' ? outcome.message : '';
        expect(message).toContain('"mezo"');
        expect(message).toMatch(/\(invalid_input_type\)\.$/);
      },
    );

    it('a choice mező opción kívüli és nem szöveg értékére invalid_input_type, az opciók felsorolásával', () => {
      const configs = configsOf(typedConfig([choiceField()]));

      for (const value of ['zold', 7]) {
        const outcome = validateRunInput(configs, 'start', { mezo: value });

        expect(outcome.kind === 'error' ? outcome.message : '').toContain('piros, kek');
        expect(outcome.kind === 'error' ? outcome.message : '').toContain('invalid_input_type');
      }
    });

    it.each([
      ['text', 'szöveg'],
      ['text', ''],
      ['number', 3],
      ['number', 2.5],
      ['number', 0],
      ['boolean', false],
      ['boolean', true],
      ['list', []],
      ['list', ['a', 'b']],
    ] as const)('a(z) %s mező helyes értéke (%j) elfogadott', (kind, value) => {
      expect(runWith(plainField(kind), value)).toStrictEqual({ kind: 'ok', value: undefined });
    });

    it('a choice mező opció értéke elfogadott', () => {
      expect(runWith(choiceField(), 'kek').kind).toBe('ok');
    });

    it('a json mező bármely értéke elfogadott, a null is', () => {
      for (const value of [{ a: 1 }, [1, 'a'], 'x', 3, true, null]) {
        expect(runWith(plainField('json'), value).kind).toBe('ok');
      }
    });

    it('a hiányzó és az undefined értékű nem kötelező mező nem hiba, bármely típusnál', () => {
      const configs = configsOf(
        typedConfig([
          plainField('number'),
          { ...choiceField(), name: 'valasztas' },
          { ...plainField('list'), name: 'l' },
        ]),
      );

      expect(validateRunInput(configs, 'start', {}).kind).toBe('ok');
      expect(validateRunInput(configs, 'start', { mezo: undefined, valasztas: undefined }).kind).toBe('ok');
    });

    it('a hiányzó kötelező mező a típus ellenőrzés előtt missing_required_input marad', () => {
      const configs = configsOf(typedConfig([plainField('number', true)]));

      const outcome = validateRunInput(configs, 'start', {});

      expect(outcome.kind === 'error' ? outcome.message : '').toContain('missing_required_input');
    });

    describe('az Object.prototype örökölt tagjai nem bemeneti értékek', () => {
      it.each(['toString', 'constructor', 'valueOf', 'hasOwnProperty'])(
        'a(z) %s nevű, kitöltetlen nem kötelező mező nem hiba',
        (name) => {
          const configs = configsOf(typedConfig([{ ...plainField('text'), name }]));

          expect(validateRunInput(configs, 'start', inputFromJson('{}')).kind).toBe('ok');
        },
      );

      it('a toString nevű, kitöltetlen kötelező mező missing_required_input, nem típushiba', () => {
        const configs = configsOf(typedConfig([{ ...plainField('text', true), name: 'toString' }]));

        const outcome = validateRunInput(configs, 'start', inputFromJson('{}'));

        expect(outcome.kind === 'error' ? outcome.message : '').toContain('missing_required_input');
      });

      it('a saját kulcsként megadott toString mező értéke továbbra is ellenőrzött', () => {
        const configs = configsOf(typedConfig([{ ...plainField('text'), name: 'toString' }]));

        expect(validateRunInput(configs, 'start', inputFromJson('{"toString": "x"}')).kind).toBe('ok');
        expect(validateRunInput(configs, 'start', inputFromJson('{"toString": 5}')).kind).toBe('error');
      });
    });

    it('egy hibás típusú mező és egy hiányzó kötelező mező együtt: a kötelező hiány jelez először', () => {
      const configs = configsOf(typedConfig([plainField('number'), { ...plainField('text', true), name: 'kotelezo' }]));

      const outcome = validateRunInput(configs, 'start', { mezo: 'nem szám' });

      expect(outcome.kind === 'error' ? outcome.message : '').toContain('missing_required_input');
    });
  });
});
