import { describe, expect, it } from 'vitest';
import { buildProbeGraph } from './build-probe-graph.ts';

function agentStepConfig(providerId: 'minimax' | 'claude-subscription', modelId?: string): Record<string, unknown> {
  const node = buildProbeGraph(providerId, modelId).nodes.find((candidate) => candidate.type === 'agent_step');
  if (node === undefined) {
    throw new Error('hiányzik az agent_step csomópont');
  }
  return { ...node.config };
}

describe('buildProbeGraph (SPEC-012 5.1 táblázat, SPEC-013 6.)', () => {
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
    expect(config['effort']).toBe('low');
    expect(config['thinking']).toBeNull();

    expect(config['maxBudgetUsd']).toBeNull();
    expect(config['disallowedTools']).toEqual([]);
  });

  it('claude-subscription esetén az alapmodell claude-haiku-4-5, effort nélkül', () => {
    const config = agentStepConfig('claude-subscription');
    expect(config['providerId']).toBe('claude-subscription');

    expect(config['modelId']).toBe('claude-haiku-4-5');
    expect(config['effort']).toBeNull();
    expect(config['thinking']).toBeNull();
    expect(config['maxTurns']).toBe(1);
  });

  it('a modelIdOverride felülírja az alapmodellt', () => {
    expect(agentStepConfig('claude-subscription', 'claude-sonnet-5')['modelId']).toBe('claude-sonnet-5');
  });
});
