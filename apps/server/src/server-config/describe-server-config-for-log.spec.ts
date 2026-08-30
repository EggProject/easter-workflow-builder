import { describe, expect, it } from 'vitest';
import type { ServerConfig } from './server-config.ts';
import { describeServerConfigForLog } from './describe-server-config-for-log.ts';

const BASE_CONFIG: ServerConfig = {
  port: 4000,
  logDirectory: '/var/log/easter',
  logRotationSize: '10m',
  logRotationFrequency: 'daily',
  logRetainedFileCount: 5,
  streamKeepAliveIntervalMs: 15_000,
};

describe('describeServerConfigForLog', () => {
  it('a port és a napló könyvtár tényleges értékét viszi', () => {
    const described = describeServerConfigForLog(BASE_CONFIG);
    expect(described['port']).toBe(4000);
    expect(described['logDirectory']).toBe('/var/log/easter');
  });

  it('a devOrigin és a logLevel értékét sosem viszi, csak a "be van állítva" tényt', () => {
    const withoutOptional = describeServerConfigForLog(BASE_CONFIG);
    expect(withoutOptional['devOriginConfigured']).toBe(false);
    expect(withoutOptional['logLevelConfigured']).toBe(false);
    expect(JSON.stringify(withoutOptional)).not.toContain('localhost');

    const withOptional = describeServerConfigForLog({
      ...BASE_CONFIG,
      devOrigin: 'http://localhost:5173',
      logLevel: 'debug',
    });
    expect(withOptional['devOriginConfigured']).toBe(true);
    expect(withOptional['logLevelConfigured']).toBe(true);
    expect(JSON.stringify(withOptional)).not.toContain('localhost');
    expect(JSON.stringify(withOptional)).not.toContain('debug');
  });

  it('a rotációs és életben tartó mezőkre a nevet és a "be van állítva" tényt közli, az értéket nem', () => {
    const described = describeServerConfigForLog(BASE_CONFIG);
    expect(described['logRotationSizeConfigured']).toBe(true);
    expect(described['logRotationFrequencyConfigured']).toBe(true);
    expect(described['logRetainedFileCountConfigured']).toBe(true);
    expect(described['streamKeepAliveIntervalMsConfigured']).toBe(true);
    expect(JSON.stringify(described)).not.toContain('10m');
    expect(JSON.stringify(described)).not.toContain('daily');
  });
});
