/* eslint-disable unicorn/no-null -- a JavaScript szkript nullázható mezői (SPEC-014 5.3) a tárolt alakban valódi `null` értéket hordoznak */
import { describe, expect, it } from 'vitest';
import type { Outcome } from '@easter-workflow-builder/core';
import type { WellFormedNodeConfig } from './well-formed-node-config.ts';
import { validateScriptSources } from './validate-script-sources.ts';

function javaScriptSettings(source: string) {
  return { source, runtime: 'javascript', timeoutMs: null, cwd: null, memoryLimitMb: null } as const;
}

function configs(): ReadonlyMap<string, WellFormedNodeConfig> {
  return new Map<string, WellFormedNodeConfig>([
    ['start', { type: 'start', inputFields: [], onUnhandledError: 'fail_run' }],
    ['cel', { type: 'script', source: 'cel-forras', runtime: 'expression', onUnhandledError: 'fail_run' }],
    ['js', { type: 'script', ...javaScriptSettings('js-forras'), onUnhandledError: 'fail_run' }],
    [
      'join-cel',
      {
        type: 'join',
        mode: 'script',
        settings: { source: 'cel-join', runtime: 'expression' },
        onUnhandledError: 'fail_run',
      },
    ],
    [
      'join-js',
      { type: 'join', mode: 'script', settings: javaScriptSettings('js-join'), onUnhandledError: 'fail_run' },
    ],
    ['merge', { type: 'join', mode: 'merge', onUnhandledError: 'fail_run' }],
  ]);
}

function recordingCompiler(failing: string | undefined): {
  readonly compile: (source: string) => Promise<Outcome<void>>;
  readonly compiled: string[];
} {
  const compiled: string[] = [];
  return {
    compiled,
    compile: (source) => {
      compiled.push(source);
      return Promise.resolve(
        source === failing
          ? { kind: 'error', message: 'A JavaScript szkript nem fordul le (script_compile_failed).' }
          : { kind: 'ok', value: undefined },
      );
    },
  };
}

describe('validateScriptSources', () => {
  it('kizárólag a JavaScript forrásokat fordítja, a node sorrendjében, és zöld', async () => {
    const compiler = recordingCompiler(undefined);

    expect(await validateScriptSources(configs(), compiler)).toStrictEqual({ kind: 'ok', value: undefined });
    expect(compiler.compiled).toStrictEqual(['js-forras', 'js-join']);
  });

  it.each([
    ['js', 'source', 'js-forras'],
    ['join-js', 'settings.source', 'js-join'],
  ])('a(z) %s csomópont %s mezőjének fordítási hibája a csomópont nevével elutasít', async (nodeId, field, source) => {
    const compiler = recordingCompiler(source);

    expect(await validateScriptSources(configs(), compiler)).toStrictEqual({
      kind: 'error',
      message: `A(z) ${nodeId} csomópont ${field} mezője nem fordítható le. A JavaScript szkript nem fordul le (script_compile_failed).`,
    });
  });

  it('az első hibánál megáll, a további forrást nem fordítja', async () => {
    const compiler = recordingCompiler('js-forras');

    await validateScriptSources(configs(), compiler);

    expect(compiler.compiled).toStrictEqual(['js-forras']);
  });
});
