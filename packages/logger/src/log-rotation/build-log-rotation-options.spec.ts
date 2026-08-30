import { describe, expect, it } from 'vitest';
import { buildLogRotationOptions } from './build-log-rotation-options.ts';

describe('buildLogRotationOptions', () => {
  it('a kötelező mezőkből építi fel az opció objektumot, mkdir true-val', () => {
    const options = buildLogRotationOptions({
      logDirectory: '/var/log/easter/server',
      size: '10m',
      frequency: 'daily',
      retainedFileCount: 5,
    });

    expect(options).toEqual({
      file: '/var/log/easter/server',
      size: '10m',
      frequency: 'daily',
      mkdir: true,
      limit: { count: 5 },
    });
  });

  it('felveszi a dateFormat mezőt, ha az meg van adva', () => {
    const options = buildLogRotationOptions({
      logDirectory: '/var/log/easter/server',
      size: '10m',
      frequency: 'daily',
      retainedFileCount: 5,
      dateFormat: 'yyyy-MM-dd',
    });

    expect(options.dateFormat).toBe('yyyy-MM-dd');
  });

  it('nem indít worker szálat és nem hoz létre fájlt: csak tiszta objektumot ad vissza', () => {
    const options = buildLogRotationOptions({
      logDirectory: '/nem-letezo/utvonal',
      size: 1,
      frequency: 'hourly',
      retainedFileCount: 1,
    });

    expect(typeof options).toBe('object');
    expect(options.mkdir).toBe(true);
  });
});
