import { describe, expect, it } from 'vitest';
import { buildScriptChildEnvironment } from './build-script-child-environment.ts';

describe('buildScriptChildEnvironment', () => {
  it('a szerver környezetéből csak a TZ megy át', () => {
    expect(
      buildScriptChildEnvironment({
        TZ: 'Europe/Budapest',
        ANTHROPIC_AUTH_TOKEN: 'titok',
        PATH: '/bin',
        NODE_OPTIONS: '-r x',
      }),
    ).toStrictEqual({ TZ: 'Europe/Budapest' });
  });

  it('TZ nélkül a környezet üres', () => {
    expect(buildScriptChildEnvironment({ ANTHROPIC_API_KEY: 'titok' })).toStrictEqual({});
  });
});
