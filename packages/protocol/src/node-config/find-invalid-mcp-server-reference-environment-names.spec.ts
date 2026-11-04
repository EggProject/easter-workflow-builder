/* eslint-disable unicorn/no-null -- az authEnvName nullázható mezője a dróton ténylegesen `null` értéket hordozza */
import { describe, expect, it } from 'vitest';
import { findInvalidMcpServerReferenceEnvironmentNames } from './find-invalid-mcp-server-reference-environment-names.ts';

describe('findInvalidMcpServerReferenceEnvironmentNames', () => {
  it('érvényes nevekre, null authEnvName mellett és hivatkozás nélkül nincs találat', () => {
    expect(
      findInvalidMcpServerReferenceEnvironmentNames({
        mcpServerReferences: {
          github: { envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' }, authEnvName: null },
          remote: { envBindings: {}, authEnvName: 'REMOTE_AUTH' },
        },
      }),
    ).toStrictEqual([]);
    expect(findInvalidMcpServerReferenceEnvironmentNames({})).toStrictEqual([]);
  });

  it('a név alakon kívüli envBindings értéket és authEnvName-et a mező útvonalán adja', () => {
    expect(
      findInvalidMcpServerReferenceEnvironmentNames({
        mcpServerReferences: {
          github: { envBindings: { GITHUB_TOKEN: 'ghp-titok', OK: 'OK_NEV', URES: '' }, authEnvName: '1ROSSZ' },
        },
      }),
    ).toStrictEqual([
      ['mcpServerReferences', 'github', 'envBindings', 'GITHUB_TOKEN'],
      ['mcpServerReferences', 'github', 'envBindings', 'URES'],
      ['mcpServerReferences', 'github', 'authEnvName'],
    ]);
  });

  it('a típushibás részeket kihagyja (azt az olvasó séma jelzi)', () => {
    expect(findInvalidMcpServerReferenceEnvironmentNames('nem rekord')).toStrictEqual([]);
    expect(findInvalidMcpServerReferenceEnvironmentNames({ mcpServerReferences: [] })).toStrictEqual([]);
    expect(
      findInvalidMcpServerReferenceEnvironmentNames({
        mcpServerReferences: { a: 'nem rekord', b: { envBindings: 'x', authEnvName: 1 }, c: { envBindings: { A: 1 } } },
      }),
    ).toStrictEqual([]);
  });
});
