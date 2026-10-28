import { describe, expect, it } from 'vitest';
import {
  AGENT_DEFINITION_FIELD_TABLE,
  UNCONFIRMED_AGENT_DEFINITION_FIELD_KEYS,
} from './agent-definition-field-table.ts';

describe('AGENT_DEFINITION_FIELD_TABLE', () => {
  it('pontosan tizenhárom, két forrással fedett mezőt sorol fel (SPEC-008 5.2, AC60)', () => {
    expect(AGENT_DEFINITION_FIELD_TABLE).toHaveLength(13);
  });

  it('a "kötelező" csoport mindkét mezője kötelező, a többi nem', () => {
    const required = AGENT_DEFINITION_FIELD_TABLE.filter((field) => field.required).map((field) => field.key);
    expect(required).toStrictEqual(['description', 'prompt']);
  });

  it('a `skills` sor a `skillek` csoport szerkeszthető vezérlője, az `mcpServers` sor olvasható és a régi alakot nevezi meg', () => {
    const skills = AGENT_DEFINITION_FIELD_TABLE.find((field) => field.key === 'skills');
    const mcpServers = AGENT_DEFINITION_FIELD_TABLE.find((field) => field.key === 'mcpServers');
    expect(skills?.group).toBe('skillek');
    expect(skills?.control.kind).toBe('skills');
    expect(mcpServers?.control.kind).toBe('readonly');
    if (mcpServers?.control.kind === 'readonly') {
      expect(mcpServers.control.reason).toContain('a régi, lépésenkénti alak');
      expect(mcpServers.group).toBe('MCP szerverek');
    }
  });

  it('a mezőkulcsok egyediek', () => {
    const keys = AGENT_DEFINITION_FIELD_TABLE.map((field) => field.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('UNCONFIRMED_AGENT_DEFINITION_FIELD_KEYS', () => {
  it('pontosan három, a tizenhármas listától különálló mezőt sorol fel', () => {
    expect(UNCONFIRMED_AGENT_DEFINITION_FIELD_KEYS).toHaveLength(3);
    const confirmedKeys = new Set<string>(AGENT_DEFINITION_FIELD_TABLE.map((field) => field.key));
    for (const key of UNCONFIRMED_AGENT_DEFINITION_FIELD_KEYS) {
      expect(confirmedKeys.has(key)).toBe(false);
    }
  });
});
