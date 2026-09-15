import { describe, expect, it } from 'vitest';
import { describeInheritedProvider } from './describe-inherited-provider.ts';

describe('describeInheritedProvider', () => {
  it('a workflow szintű felülírást nevezi meg, ha van', () => {
    expect(describeInheritedProvider('minimax', 'claude-subscription')).toContain('minimax');
  });

  it('a globális alapértelmezést nevezi meg, ha nincs workflow szintű felülírás', () => {
    // eslint-disable-next-line unicorn/no-null -- a `WorkflowDetail.providerId` `null` értéke jelenti a "nincs felülírás" állapotot (SPEC-005).
    expect(describeInheritedProvider(null, 'claude-subscription')).toContain('claude-subscription');
  });

  it('kimondja, ha egyik szinten sincs megadott provider', () => {
    // eslint-disable-next-line unicorn/no-null -- lásd fent, mindkét szint "nincs felülírás" állapotban.
    const description = describeInheritedProvider(null, null);
    expect(description).toContain('nincs meghatározva');
  });
});
