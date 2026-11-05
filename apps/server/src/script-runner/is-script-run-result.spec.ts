/* eslint-disable unicorn/no-null -- a szkript `null` kimenete is JSON érték */
import { describe, expect, it } from 'vitest';
import { isScriptRunResult } from './is-script-run-result.ts';

describe('isScriptRunResult', () => {
  it.each([
    { kind: 'succeeded', output: { a: 1 } },
    { kind: 'succeeded', output: null },
    { kind: 'failed', errorKind: 'script_evaluation_failed', message: 'x' },
    { kind: 'failed', errorKind: 'script_timed_out', message: 'x' },
    { kind: 'failed', errorKind: 'script_output_not_json', message: 'x' },
  ])('elfogadja: %j', (value) => {
    const candidate: unknown = value;
    expect(isScriptRunResult(candidate)).toBe(true);
    if (isScriptRunResult(candidate)) {
      expect(candidate.kind).toBe(value.kind);
    }
  });

  it.each([
    ['nem objektum', 1],
    ['kimenet nélküli siker', { kind: 'succeeded' }],
    ['aborted, mert a folyamatból nem jöhet', { kind: 'aborted' }],
    ['ismeretlen kind', { kind: 'other', output: 1 }],
    ['ismeretlen hibaosztály', { kind: 'failed', errorKind: 'agent_failed', message: 'x' }],
    ['nem szöveg üzenet', { kind: 'failed', errorKind: 'script_timed_out', message: 1 }],
    ['ismeretlen kulcs a hibán', { kind: 'failed', errorKind: 'script_timed_out', message: 'x', extra: 1 }],
    ['siker hibaosztállyal', { kind: 'succeeded', errorKind: 'script_timed_out', message: 'x' }],
  ])('elutasítja: %s', (_name, value) => {
    expect(isScriptRunResult(value)).toBe(false);
  });
});
