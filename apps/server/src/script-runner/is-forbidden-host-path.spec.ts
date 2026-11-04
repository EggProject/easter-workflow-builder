import { describe, expect, it } from 'vitest';
import { isForbiddenHostPath } from './is-forbidden-host-path.ts';

describe('isForbiddenHostPath', () => {
  it.each(['/proc', '/proc/self/environ', '/dev', '/dev/zero'])('%s tiltott', (candidate) => {
    expect(isForbiddenHostPath(candidate)).toBe(true);
  });

  it.each(['/', '/tmp', '/procs', '/device', '/home/dev'])('%s nem tiltott', (candidate) => {
    expect(isForbiddenHostPath(candidate)).toBe(false);
  });
});
