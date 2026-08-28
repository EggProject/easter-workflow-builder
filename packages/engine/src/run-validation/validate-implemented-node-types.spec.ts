import { describe, expect, it } from 'vitest';
import type { NodeConfig } from '@easter-workflow-builder/db';
import { validateImplementedNodeTypes } from './validate-implemented-node-types.ts';

const START: NodeConfig = { type: 'start', inputFields: [], onUnhandledError: 'fail_run' };
const JOIN_MERGE: NodeConfig = { type: 'join', mode: 'merge', settings: {}, onUnhandledError: 'fail_run' };
const SCRIPT: NodeConfig = {
  type: 'script',
  source: 'ertek',
  runtime: 'expression',
  onUnhandledError: 'fail_run',
};
const JOIN_SCRIPT: NodeConfig = {
  type: 'join',
  mode: 'script',
  settings: { source: 'ertek', runtime: 'expression' },
  onUnhandledError: 'fail_run',
};

describe('validateImplementedNodeTypes', () => {
  it('a végrehajtható configokat változatlanul, szűkített típussal adja vissza', () => {
    const configsById: ReadonlyMap<string, NodeConfig> = new Map<string, NodeConfig>([
      ['start', START],
      ['j', JOIN_MERGE],
    ]);

    expect(validateImplementedNodeTypes(configsById)).toStrictEqual({
      kind: 'ok',
      value: new Map<string, NodeConfig>([
        ['start', START],
        ['j', JOIN_MERGE],
      ]),
    });
  });

  it('script node-ra unimplemented_node_type hibát ad', () => {
    const configsById: ReadonlyMap<string, NodeConfig> = new Map<string, NodeConfig>([['s', SCRIPT]]);

    expect(validateImplementedNodeTypes(configsById)).toStrictEqual({
      kind: 'error',
      message: 'A(z) s node a script node típus, amit az első verzió nem hajt végre (unimplemented_node_type).',
    });
  });

  it('script módú join node-ra unimplemented_node_type hibát ad', () => {
    const configsById: ReadonlyMap<string, NodeConfig> = new Map<string, NodeConfig>([['j', JOIN_SCRIPT]]);

    expect(validateImplementedNodeTypes(configsById)).toStrictEqual({
      kind: 'error',
      message: 'A(z) j node a join node script módja, amit az első verzió nem hajt végre (unimplemented_node_type).',
    });
  });

  it('üres bemenetre üres térképet ad', () => {
    expect(validateImplementedNodeTypes(new Map())).toStrictEqual({ kind: 'ok', value: new Map() });
  });
});
