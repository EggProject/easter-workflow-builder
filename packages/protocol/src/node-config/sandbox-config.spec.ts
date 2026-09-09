import { describe, expect, it } from 'vitest';
import { SandboxConfigSchema } from './sandbox-config.ts';

const BASE = {
  enabled: true,
  failIfUnavailable: false,
  autoAllowBashIfSandboxed: true,
  excludedCommands: ['rm'],
  enableWeakerNestedSandbox: false,
};

describe('SandboxConfigSchema', () => {
  it('elfogadja az öt kötelező mezőt, az öt nyitott mező nélkül', () => {
    expect(SandboxConfigSchema.safeParse(BASE).success).toBe(true);
  });

  it('elfogadja a nyitott mezőket bármilyen értékkel', () => {
    const result = SandboxConfigSchema.safeParse({
      ...BASE,
      allowUnsandboxedCommands: ['ls'],
      network: { disabled: true },
      filesystem: { allow: ['/tmp'] },
      ignoreViolations: false,
      ripgrep: 'auto',
    });
    expect(result.success).toBe(true);
  });

  it('hiányzó kötelező mezőre elutasít', () => {
    const { enabled, ...withoutEnabled } = BASE;
    expect(enabled).toBe(true);
    expect(SandboxConfigSchema.safeParse(withoutEnabled).success).toBe(false);
  });

  it('ismeretlen kulcsot elutasít (strictObject)', () => {
    expect(SandboxConfigSchema.safeParse({ ...BASE, unknownField: 1 }).success).toBe(false);
  });
});
