import { describe, expect, it } from 'vitest';
import { errorToolResult } from './error-tool-result.ts';

describe('errorToolResult', () => {
  it('hibajelzéssel adja vissza az üzenetet', () => {
    expect(errorToolResult('baj van')).toStrictEqual({
      content: [{ type: 'text', text: 'baj van' }],
      isError: true,
    });
  });
});
