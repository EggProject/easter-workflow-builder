/* eslint-disable unicorn/no-null -- a port `timeoutMs`, `cwd` és a korlát mezők üres értéke a tárolt `null` (SPEC-014 5.3) */
import path from 'node:path';
import type { ScriptRunRequest } from '@easter-workflow-builder/engine';
import { describe, expect, it } from 'vitest';
import { buildSandboxRunRequest } from './build-sandbox-run-request.ts';

const BASE: ScriptRunRequest = {
  source: 'return 1;',
  runContext: {
    input: { a: 1 },
    steps: { s: 2 },
    item: undefined,
    itemIndex: undefined,
    iteration: 3,
    joinInputs: undefined,
    error: undefined,
  },
  timeoutMs: null,
  cwd: null,
  memoryLimitMb: 64,
  fetchResponseLimitMb: 5,
  fileReadLimitMb: null,
  signal: new AbortController().signal,
};

describe('buildSandboxRunRequest', () => {
  it('a null időkorlát 60 000 ms, a null cwd a szerver munkakönyvtára, a hiányzó név kimarad a JSON-ból', () => {
    expect(buildSandboxRunRequest(BASE, 1000)).toStrictEqual({
      source: 'return 1;',
      contextJson: '{"input":{"a":1},"steps":{"s":2},"iteration":3}',
      root: process.cwd(),
      timeoutMs: 60_000,
      deadlineMs: 61_000,
      memoryLimitMb: 64,
      fetchResponseLimitMb: 5,
      fileReadLimitMb: null,
    });
  });

  it('a megadott időkorlát a határidőt adja, a relatív cwd a munkakönyvtárhoz oldódik fel', () => {
    const built = buildSandboxRunRequest({ ...BASE, timeoutMs: 250, cwd: 'alkonyvtar/../adat' }, 10);
    expect(built.timeoutMs).toBe(250);
    expect(built.deadlineMs).toBe(260);
    expect(built.root).toBe(path.resolve(process.cwd(), 'adat'));
  });
});
