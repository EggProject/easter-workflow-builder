import { describe, expect, it } from 'vitest';
import { BLANK_FIELD_MESSAGE } from './blank-field-message.ts';
import { NodeConfigSaveSchema } from './node-config-save-schema.ts';

describe('BLANK_FIELD_MESSAGE', () => {
  it('a mentési séma az üres kötelező szöveg mezőre ezt a mondatot adja', () => {
    const parsed = NodeConfigSaveSchema.safeParse({
      type: 'script',
      source: ' ',
      runtime: 'expression',
      onUnhandledError: 'fail_run',
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((issue) => issue.message)).toEqual([BLANK_FIELD_MESSAGE]);
  });
});
