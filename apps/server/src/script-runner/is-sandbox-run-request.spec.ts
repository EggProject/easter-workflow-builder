/* eslint-disable unicorn/no-null -- a korlát mezők üres értéke a `null` (SPEC-014 5.3) */
import { describe, expect, it } from 'vitest';
import { isSandboxRunRequest } from './is-sandbox-run-request.ts';
import type { SandboxRunRequest } from './sandbox-run-request.ts';

const VALID: SandboxRunRequest = {
  source: 'return 1;',
  contextJson: '{}',
  root: '/tmp',
  timeoutMs: 100,
  deadlineMs: 200,
  memoryLimitMb: null,
  fetchResponseLimitMb: 1,
  fileReadLimitMb: null,
};

describe('isSandboxRunRequest', () => {
  it('a teljes kérést elfogadja, és a típust szűkíti', () => {
    const value: unknown = { ...VALID };
    expect(isSandboxRunRequest(value)).toBe(true);
    if (isSandboxRunRequest(value)) {
      expect(value.root).toBe('/tmp');
    }
  });

  it.each([
    ['nem objektum', 'szöveg'],
    ['ismeretlen kulcs', { ...VALID, signal: true }],
    ['hiányzó forrás', { ...VALID, source: undefined }],
    ['nem szöveg kontextus', { ...VALID, contextJson: 1 }],
    ['nem szöveg gyökér', { ...VALID, root: null }],
    ['nem szám időkorlát', { ...VALID, timeoutMs: '1' }],
    ['nem szám határidő', { ...VALID, deadlineMs: null }],
    ['nem szám memória korlát', { ...VALID, memoryLimitMb: '16' }],
    ['nem szám válasz plafon', { ...VALID, fetchResponseLimitMb: true }],
    ['nem szám fájl plafon', { ...VALID, fileReadLimitMb: [] }],
  ])('elutasítja: %s', (_name, value) => {
    expect(isSandboxRunRequest(value)).toBe(false);
  });
});
