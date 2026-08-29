import { describe, expect, it } from 'vitest';
import { buildProviderDescriptorLookup } from './build-provider-descriptor-lookup.ts';

describe('buildProviderDescriptorLookup', () => {
  it('mindkét rögzített providerre leírót ad', () => {
    const lookup = buildProviderDescriptorLookup();
    expect(lookup('minimax').id).toBe('minimax');
    expect(lookup('claude-subscription').id).toBe('claude-subscription');
  });
});
