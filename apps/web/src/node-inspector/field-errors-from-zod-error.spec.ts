import { describe, expect, it } from 'vitest';
import { fieldErrorsFromZodError, type ZodErrorLike } from './field-errors-from-zod-error.ts';

describe('fieldErrorsFromZodError', () => {
  it('mezőnkénti térképet épít az útvonal pontokkal összefűzött alakjából', () => {
    const error: ZodErrorLike = {
      issues: [
        { path: ['name'], message: 'kötelező mező' },
        { path: ['age'], message: 'számnak kell lennie' },
      ],
    };
    const errors = fieldErrorsFromZodError(error);
    expect(errors.get('name')).toBeDefined();
    expect(errors.get('age')).toBeDefined();
  });

  it('beágyazott útvonalat pontokkal fűz össze', () => {
    const error: ZodErrorLike = { issues: [{ path: ['branches', 0, 'key'], message: 'szövegnek kell lennie' }] };
    const errors = fieldErrorsFromZodError(error);
    expect(errors.has('branches.0.key')).toBe(true);
  });

  it('egy útvonalon több hiba esetén az elsőt tartja meg', () => {
    const duplicatePathError: ZodErrorLike = {
      issues: [
        { path: ['a'], message: 'első' },
        { path: ['a'], message: 'második' },
      ],
    };
    const errors = fieldErrorsFromZodError(duplicatePathError);
    expect(errors.get('a')).toBe('első');
  });
});
