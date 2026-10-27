import { describe, expect, it } from 'vitest';
import { acceptedEnvironmentNames } from './accepted-environment-names.ts';

const EVIDENCE = [{ kind: 'measurement', id: 'M-99' }] as const;

describe('acceptedEnvironmentNames', () => {
  it('literal forrásnál egyedül a name', () => {
    expect(
      acceptedEnvironmentNames({
        name: 'ANTHROPIC_BASE_URL',
        source: 'literal',
        literalValue: 'https://pelda',
        secret: false,
        purpose: 'fake',
        evidence: EVIDENCE,
      }),
    ).toStrictEqual(['ANTHROPIC_BASE_URL']);
  });

  it('process_env_passthrough forrásnál egyedül a name', () => {
    expect(
      acceptedEnvironmentNames({
        name: 'KULCS',
        source: 'process_env_passthrough',
        secret: true,
        purpose: 'fake',
        evidence: EVIDENCE,
      }),
    ).toStrictEqual(['KULCS']);
  });

  it('process_env_alternatives forrásnál a name, utána az alternatív nevek sorrendben', () => {
    expect(
      acceptedEnvironmentNames({
        name: 'ANTHROPIC_AUTH_TOKEN',
        source: 'process_env_alternatives',
        alternativeNames: ['ANTHROPIC_API_KEY', 'HARMADIK'],
        secret: true,
        purpose: 'fake',
        evidence: EVIDENCE,
      }),
    ).toStrictEqual(['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY', 'HARMADIK']);
  });
});
