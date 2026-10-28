/* eslint-disable unicorn/no-null -- a `skills` és az `authEnvName` tárolt alakja `null`-lal jelzi a hiányt (SPEC-003 4.4, SPEC-009 6.2) */
import { describe, expect, it } from 'vitest';
import { parseAgentDefinition } from './parse-agent-definition.ts';

const REFERENCE = { envBindings: { TOKEN: 'TOKEN_CEG' }, authEnvName: null };

describe('parseAgentDefinition', () => {
  it('a két olvasott mezőt kiveszi, a többi mezőt változatlanul a rest-ben hagyja', () => {
    expect(
      parseAgentDefinition({
        description: 'd',
        prompt: 'p',
        model: 'sonnet',
        skills: ['alfa'],
        mcpServerReferences: { github: REFERENCE },
        mcpServers: ['regi'],
      }),
    ).toStrictEqual({
      rest: { description: 'd', prompt: 'p', model: 'sonnet', mcpServers: ['regi'] },
      skills: ['alfa'],
      mcpServerReferences: { github: REFERENCE },
    });
  });

  it('a név alakú authEnvName felülírás átmegy', () => {
    const reference = { envBindings: {}, authEnvName: 'AUTH_CEG' };

    expect(parseAgentDefinition({ mcpServerReferences: { remote: reference } })?.mcpServerReferences).toStrictEqual({
      remote: reference,
    });
  });

  it("a hiányzó skills kulcs null, a hiányzó hivatkozás mező üres rekord, az 'all' és a null megmarad", () => {
    expect(parseAgentDefinition({ description: 'd', prompt: 'p' })).toStrictEqual({
      rest: { description: 'd', prompt: 'p' },
      skills: null,
      mcpServerReferences: {},
    });
    expect(parseAgentDefinition({ skills: 'all' })?.skills).toBe('all');
    expect(parseAgentDefinition({ skills: null })?.skills).toBeNull();
  });

  it.each([
    ['nem objektum', 'segito'],
    ['null', null],
    ['szám skills', { skills: 7 }],
    ['nem szöveg elemű skills', { skills: ['alfa', 1] }],
    ['ismeretlen szöveg skills', { skills: 'mind' }],
    ['nem rekord hivatkozás mező', { mcpServerReferences: ['github'] }],
    ['hibás alakú hivatkozás', { mcpServerReferences: { github: { envBindings: {} } } }],
    ['nem lista régi mcpServers', { mcpServers: { regi: {} } }],
    [
      'nem név alakú envBindings érték (T-012-27)',
      { mcpServerReferences: { github: { envBindings: { TOKEN: 'ghp-titok' }, authEnvName: null } } },
    ],
    ['nem név alakú authEnvName (T-012-27)', { mcpServerReferences: { github: { envBindings: {}, authEnvName: '' } } }],
  ])('érvénytelen alakra undefined: %s', (_name, value) => {
    expect(parseAgentDefinition(value)).toBeUndefined();
  });
});
