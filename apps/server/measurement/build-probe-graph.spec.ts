import { describe, expect, it } from 'vitest';
import { buildProbeGraph } from './build-probe-graph.ts';

function agentStepConfig(providerId: 'minimax' | 'claude-subscription'): Record<string, unknown> {
  const node = buildProbeGraph(providerId).nodes.find((candidate) => candidate.type === 'agent_step');
  if (node === undefined) {
    throw new Error('hiányzik az agent_step csomópont');
  }
  return { ...node.config };
}

describe('buildProbeGraph (SPEC-012 5.1 táblázat)', () => {
  it('Start és egyetlen agent_step, egyetlen éllel', () => {
    const graph = buildProbeGraph('minimax');
    expect(graph.nodes.map((node) => node.type)).toEqual(['start', 'agent_step']);
    expect(graph.edges).toHaveLength(1);
  });

  it('minimax esetén MiniMax-M3.1-Flash modell, maxTurns 1, költségkeret és eszköz tiltás nélkül', () => {
    const config = agentStepConfig('minimax');
    expect(config['providerId']).toBe('minimax');
    expect(config['modelId']).toBe('MiniMax-M3.1-Flash');
    expect(config['maxTurns']).toBe(1);

    expect(config['maxBudgetUsd']).toBeNull();
    expect(config['disallowedTools']).toEqual([]);
  });

  it('claude-subscription esetén nincs modelId', () => {
    const config = agentStepConfig('claude-subscription');
    expect(config['providerId']).toBe('claude-subscription');

    expect(config['modelId']).toBeNull();
    expect(config['maxTurns']).toBe(1);
  });
});
