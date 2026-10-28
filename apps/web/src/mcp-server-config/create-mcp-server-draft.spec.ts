import type { McpServerDefinitionRecord } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { createMcpServerDraft } from './create-mcp-server-draft.ts';

describe('createMcpServerDraft', () => {
  it('új szervernél üres stdio űrlapot ad', () => {
    expect(createMcpServerDraft(undefined)).toEqual({
      name: '',
      type: 'stdio',
      command: '',
      args: [],
      envNames: [],
      envBindings: {},
      url: '',
      authEnvName: '',
    });
  });

  it('stdio szervernél a tárolt mezőket tölti, a távoli ág mezői üresek', () => {
    const record: McpServerDefinitionRecord = {
      name: 'github',
      definition: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', 'szerver'],
        envNames: ['GITHUB_TOKEN'],
        envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' },
      },
    };

    expect(createMcpServerDraft(record)).toEqual({
      name: 'github',
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'szerver'],
      envNames: ['GITHUB_TOKEN'],
      envBindings: { GITHUB_TOKEN: 'GITHUB_TOKEN_CEG' },
      url: '',
      authEnvName: '',
    });
  });

  it('http és sse szervernél az URL-t és az Authorization változó nevét tölti', () => {
    const http = createMcpServerDraft({
      name: 'tavoli',
      // eslint-disable-next-line unicorn/no-null -- a definíció `authEnvName` mezője `null` a "nincs Authorization" állapotban.
      definition: { type: 'http', url: 'https://mcp.example.test', authEnvName: null },
    });
    const sse = createMcpServerDraft({
      name: 'esemeny',
      definition: { type: 'sse', url: 'https://sse.example.test', authEnvName: 'SSE_TOKEN' },
    });

    expect(http).toMatchObject({ name: 'tavoli', type: 'http', url: 'https://mcp.example.test', authEnvName: '' });
    expect(sse).toMatchObject({
      name: 'esemeny',
      type: 'sse',
      url: 'https://sse.example.test',
      authEnvName: 'SSE_TOKEN',
    });
  });
});
