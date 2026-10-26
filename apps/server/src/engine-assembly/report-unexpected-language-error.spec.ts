import { describe, expect, it } from 'vitest';
import { createServerLogger } from '@easter-workflow-builder/logger';
import { reportUnexpectedLanguageError } from './report-unexpected-language-error.ts';

function collectingLogger(): { readonly logger: ReturnType<typeof createServerLogger>; readonly lines: string[] } {
  const lines: string[] = [];
  return {
    logger: createServerLogger(
      { secretValues: [] },
      {
        write: (line: string) => {
          lines.push(line);
        },
      },
    ),
    lines,
  };
}

describe('reportUnexpectedLanguageError', () => {
  it('a kivétel típusnevét hordozó hibaágat error szinten naplózza a művelettel, és változatlanul továbbadja', () => {
    const { logger, lines } = collectingLogger();
    const outcome = { kind: 'error', message: 'a sablon nem renderelhető', unexpectedErrorType: 'RangeError' } as const;

    expect(reportUnexpectedLanguageError(outcome, 'template_render', logger)).toBe(outcome);

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? '')).toMatchObject({
      level: 50,
      operation: 'template_render',
      errorType: 'RangeError',
      msg: 'A sablon vagy a kifejezés feldolgozása előre nem látott kivétellel zárult.',
    });
  });

  it('a típusnév nélküli hibaágat és az ok ágat nem naplózza', () => {
    const { logger, lines } = collectingLogger();

    expect(reportUnexpectedLanguageError({ kind: 'error', message: 'x' }, 'expression_compile', logger)).toStrictEqual({
      kind: 'error',
      message: 'x',
    });
    expect(reportUnexpectedLanguageError({ kind: 'ok', value: 1 }, 'expression_evaluate', logger)).toStrictEqual({
      kind: 'ok',
      value: 1,
    });
    expect(lines).toStrictEqual([]);
  });
});
