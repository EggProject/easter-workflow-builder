import { describe, expect, it } from 'vitest';
import { hasStructuredOutput } from './has-structured-output.ts';
import type { SdkResultMessage } from './sdk-result-message.ts';

describe('hasStructuredOutput', () => {
  it('igazat ad, ha a `structured_output` mező jelen van', () => {
    const message: SdkResultMessage = { type: 'result', subtype: 'success', structured_output: { answer: 42 } };

    expect(hasStructuredOutput(message)).toBe(true);
  });

  it('hamisat ad, ha a `structured_output` mező hiányzik', () => {
    const message: SdkResultMessage = { type: 'result', subtype: 'success' };

    expect(hasStructuredOutput(message)).toBe(false);
  });

  it('hamisat ad hibaágon, ahol a valódi SDK sosem hordozza a mezőt', () => {
    const message: SdkResultMessage = { type: 'result', subtype: 'error_max_turns' };

    expect(hasStructuredOutput(message)).toBe(false);
  });
});
