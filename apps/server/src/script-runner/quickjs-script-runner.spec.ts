import { describe, expect, it } from 'vitest';
import { compileScript } from './compile-script.ts';
import { quickJsScriptRunner } from './quickjs-script-runner.ts';
import { runScript } from './run-script.ts';

describe('quickJsScriptRunner', () => {
  it('a port két művelete a fordító és a futtató', () => {
    expect(quickJsScriptRunner.compile).toBe(compileScript);
    expect(quickJsScriptRunner.run).toBe(runScript);
  });
});
