/* eslint-disable unicorn/no-null -- az `authEnvName` tárolt alakja `null`-lal jelöli a fejléc hiányát */
import { describe, expect, it } from 'vitest';
import { isMcpServerDefinition } from './is-mcp-server-definition.ts';
import type { McpServerDefinition } from './mcp-server-definition.ts';

const stdio: McpServerDefinition = {
  type: 'stdio',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  envNames: ['GITHUB_TOKEN'],
  envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' },
};
const sse: McpServerDefinition = { type: 'sse', url: 'https://example.test/sse', authEnvName: 'SSE_AUTH' };
const http: McpServerDefinition = { type: 'http', url: 'https://example.test/mcp', authEnvName: null };

describe('isMcpServerDefinition', () => {
  it('igazat ad mindhárom ágra', () => {
    expect(isMcpServerDefinition(stdio)).toBe(true);
    expect(isMcpServerDefinition({ ...stdio, envNames: [], envBindings: {} })).toBe(true);
    expect(isMcpServerDefinition(sse)).toBe(true);
    expect(isMcpServerDefinition({ ...sse, authEnvName: null })).toBe(true);
    expect(isMcpServerDefinition(http)).toBe(true);
    expect(isMcpServerDefinition({ ...http, authEnvName: 'HTTP_AUTH' })).toBe(true);
  });

  it.each([
    ['nem objektum', 'stdio'],
    ['ismeretlen típus', { type: 'sdk', name: 'x' }],
    ['típus nélkül', { command: 'x' }],
    ['stdio ismeretlen kulccsal (env érték rekord)', { ...stdio, env: { GITHUB_TOKEN: 'titok' } }],
    ['stdio szöveg nélküli parancs', { ...stdio, command: 1 }],
    ['stdio nem lista args', { ...stdio, args: 'x' }],
    ['stdio nem lista envNames', { ...stdio, envNames: 'GITHUB_TOKEN' }],
    ['stdio envBindings nélkül', { type: 'stdio', command: 'x', args: [], envNames: [] }],
    ['stdio nem név értékű envBindings', { ...stdio, envBindings: { GITHUB_TOKEN: 1 } }],
    ['sse ismeretlen kulccsal (fejléc érték)', { ...sse, headers: { Authorization: 'titok' } }],
    ['sse nem szöveg url', { ...sse, url: 1 }],
    ['sse nem név authEnvName', { ...sse, authEnvName: 1 }],
    ['http envBindings mezővel', { ...http, envBindings: {} }],
    ['http nem szöveg url', { ...http, url: null }],
    ['http nem név authEnvName', { ...http, authEnvName: 1 }],
  ])('hamisat ad: %s', (_label, value) => {
    expect(isMcpServerDefinition(value)).toBe(false);
  });
});
