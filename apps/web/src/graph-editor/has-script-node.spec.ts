import { describe, expect, it } from 'vitest';
import { hasScriptNode } from './has-script-node.ts';

describe('hasScriptNode', () => {
  it('üres gráfra hamis', () => {
    expect(hasScriptNode([])).toBe(false);
  });

  it('script nélküli gráfra hamis', () => {
    expect(hasScriptNode([{ type: 'start' }, { type: 'agent_step' }])).toBe(false);
  });

  it('egyetlen script lépés is igazra vált', () => {
    expect(hasScriptNode([{ type: 'start' }, { type: 'script' }, { type: 'agent_step' }])).toBe(true);
  });
});
