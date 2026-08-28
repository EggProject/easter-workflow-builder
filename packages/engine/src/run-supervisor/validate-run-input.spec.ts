/* eslint-disable unicorn/no-null -- a node configok nullázható mezői (SPEC-003 4.3) a tárolt alakban valódi `null` értéket hordoznak */
import { describe, expect, it } from 'vitest';
import type { ExecutableNodeConfig } from '../run-validation/executable-node-config.ts';
import { validateRunInput } from './validate-run-input.ts';

function startConfig(fields: readonly { readonly name: string; readonly required: boolean }[]): ExecutableNodeConfig {
  return {
    type: 'start',
    inputFields: fields.map((field) => ({
      name: field.name,
      label: field.name,
      valueKind: 'string',
      required: field.required,
    })),
    onUnhandledError: 'fail_run',
  };
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
});
