import { describe, expect, it } from 'vitest';
import type { FetchFunction } from '../http/fetch-function.ts';
import type { ReadFileFunction } from '../image/read-file-function.ts';
import type { AgentToolDependencies } from './agent-tool-dependencies.ts';
import { AGENT_TOOLS_SERVER_NAME } from './agent-tools-server-name.ts';
import { createAgentToolBundle } from './create-agent-tool-bundle.ts';

const dependencies: AgentToolDependencies = {
  fetchFunction: (() => Promise.reject(new Error('nem hasznalt'))) satisfies FetchFunction,
  environment: {},
  readFileFunction: (() => Promise.reject(new Error('nem hasznalt'))) satisfies ReadFileFunction,
};

describe('createAgentToolBundle', () => {
  it('üres kiválasztásra üres engedélylistát ad, de a szerver konfigurációt megadja', () => {
    const bundle = createAgentToolBundle([], dependencies);
    expect(bundle.allowedTools).toStrictEqual([]);
    expect(Object.keys(bundle.mcpServers)).toStrictEqual([AGENT_TOOLS_SERVER_NAME]);
  });

  it('csak a kiválasztott eszközöket engedélyezi', () => {
    const bundle = createAgentToolBundle(['web_search', 'understand_image'], dependencies);
    expect(bundle.allowedTools).toStrictEqual(['mcp__agent-tools__web_search', 'mcp__agent-tools__understand_image']);
  });

  it('az ismétlődő azonosítót nem duplikálja', () => {
    const bundle = createAgentToolBundle(['web_fetch', 'web_fetch'], dependencies);
    expect(bundle.allowedTools).toStrictEqual(['mcp__agent-tools__web_fetch']);
  });

  it('függőségek megadása nélkül az alapértelmezésekkel dolgozik', () => {
    const bundle = createAgentToolBundle(['web_search']);
    expect(bundle.allowedTools).toStrictEqual(['mcp__agent-tools__web_search']);
  });
});
