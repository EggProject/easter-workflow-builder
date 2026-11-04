import { describe, expect, it } from 'vitest';
import { isForbiddenScriptCwd } from './is-forbidden-script-cwd.ts';

describe('isForbiddenScriptCwd', () => {
  it.each(['/proc', '/proc/', '/proc/self', '/dev', '/dev/shm', '/srv/../proc', '//dev//', '/./proc/./1', '/../dev'])(
    '%s tiltott',
    (cwd) => {
      expect(isForbiddenScriptCwd(cwd)).toBe(true);
    },
  );

  it.each(['/', '/srv', '/procs', '/devices', '/home/proc', '/proc/../tmp', 'proc', '../../proc', '', '.'])(
    '%s nem tiltott lexikálisan',
    (cwd) => {
      expect(isForbiddenScriptCwd(cwd)).toBe(false);
    },
  );
});
