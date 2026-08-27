import { describe, expect, it } from 'vitest';
import type { FetchFunction } from '@easter-workflow-builder/http-client';
import type { ReadFileFunction } from '@easter-workflow-builder/image-source';
import type { AgentToolDependencies } from './agent-tool-dependencies.ts';
import { createAgentTool } from './create-agent-tool.ts';

const dependencies: AgentToolDependencies = {
  fetchFunction: (() => Promise.reject(new Error('nem hasznalt'))) satisfies FetchFunction,
  environment: {},
  readFileFunction: (() => Promise.reject(new Error('nem hasznalt'))) satisfies ReadFileFunction,
};

describe('createAgentTool', () => {
  it('minden azonosítóhoz az azonos nevű eszközt adja', () => {
    expect(createAgentTool('web_search', dependencies).name).toBe('web_search');
    expect(createAgentTool('web_fetch', dependencies).name).toBe('web_fetch');
    expect(createAgentTool('understand_image', dependencies).name).toBe('understand_image');
  });
});
