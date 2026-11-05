import { describe, expect, it } from 'vitest';
import { buildScriptChildEnvironment } from './build-script-child-environment.ts';

describe('buildScriptChildEnvironment', () => {
  it('a szerver környezetéből csak a TZ és a NODE_EXTRA_CA_CERTS megy át', () => {
    expect(
      buildScriptChildEnvironment({
        TZ: 'Europe/Budapest',
        NODE_EXTRA_CA_CERTS: '/etc/ca.pem',
        ANTHROPIC_AUTH_TOKEN: 'titok',
        PATH: '/bin',
        NODE_OPTIONS: '-r x',
        HTTPS_PROXY: 'https://felhasznalo:jelszo@proxy:3128',
      }),
    ).toStrictEqual({ TZ: 'Europe/Budapest', NODE_EXTRA_CA_CERTS: '/etc/ca.pem' });
  });

  it('a két név nélkül a környezet üres', () => {
    expect(buildScriptChildEnvironment({ ANTHROPIC_API_KEY: 'titok' })).toStrictEqual({});
  });
});
