import { describe, expect, it } from 'vitest';
import { textToolResult } from './text-tool-result.ts';

describe('textToolResult', () => {
  it('egyetlen szöveges blokkot ad, hibajelzés nélkül', () => {
    expect(textToolResult('valasz')).toStrictEqual({
      content: [{ type: 'text', text: 'valasz' }],
      isError: false,
    });
  });
});
