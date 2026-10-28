import { describe, expect, it } from 'vitest';
import { skillUploadFailure } from './skill-upload-failure.ts';

describe('skillUploadFailure', () => {
  it('a hibaosztályt a záró zárójelbe, a részletet elé írja', () => {
    expect(skillUploadFailure('skill_archive_too_large', 'A csomag túl nagy')).toStrictEqual({
      kind: 'error',
      message: 'A csomag túl nagy (skill_archive_too_large).',
    });
  });
});
