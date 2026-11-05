/* eslint-disable unicorn/no-null -- a port `cwd` és korlát mezőinek üres értéke a tárolt `null` (SPEC-014 5.3) */
import { describe, expect, it } from 'vitest';
import { compileScript } from './compile-script.ts';
import { quickJsScriptRunner } from './quickjs-script-runner.ts';

describe('quickJsScriptRunner', () => {
  it('a fordító a szerver folyamatában fut, a futtató külön szkript folyamatban', async () => {
    expect(quickJsScriptRunner.compile).toBe(compileScript);
    await expect(
      quickJsScriptRunner.run({
        source: 'return [1, 2].map((x) => x * 2);',
        runContext: {
          input: {},
          steps: {},
          item: undefined,
          itemIndex: undefined,
          iteration: undefined,
          joinInputs: undefined,
          error: undefined,
        },
        timeoutMs: null,
        cwd: null,
        memoryLimitMb: 64,
        fetchResponseLimitMb: null,
        fileReadLimitMb: null,
        signal: new AbortController().signal,
      }),
    ).resolves.toStrictEqual({ kind: 'succeeded', output: [2, 4] });
  });
});
