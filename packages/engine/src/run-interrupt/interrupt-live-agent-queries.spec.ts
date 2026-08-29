import { describe, expect, it, vi } from 'vitest';
import type { AgentQuery } from '@easter-workflow-builder/agent';
import { createAgentQueryRegistry } from './agent-query-registry.ts';
import { interruptLiveAgentQueries } from './interrupt-live-agent-queries.ts';

function fakeQuery(interrupt: () => Promise<void>): AgentQuery {
  return {
    messages: { [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({ done: true, value: undefined }) }) },
    interrupt,
  };
}

describe('interruptLiveAgentQueries', () => {
  it('a megadott futásokhoz tartozó MINDEN élő query-n meghívja az interrupt()-ot', async () => {
    const registry = createAgentQueryRegistry();
    const first = vi.fn(() => Promise.resolve());
    const second = vi.fn(() => Promise.resolve());
    registry.register('run-1', 'step-1', fakeQuery(first));
    registry.register('run-1', 'step-2', fakeQuery(second));

    await interruptLiveAgentQueries(new Set(['run-1']), registry);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('máshoz tartozó query-n nem hív interrupt-ot', async () => {
    const registry = createAgentQueryRegistry();
    const inScope = vi.fn(() => Promise.resolve());
    const outOfScope = vi.fn(() => Promise.resolve());
    registry.register('run-1', 'step-1', fakeQuery(inScope));
    registry.register('run-masik', 'step-masik', fakeQuery(outOfScope));

    await interruptLiveAgentQueries(new Set(['run-1']), registry);

    expect(inScope).toHaveBeenCalledTimes(1);
    expect(outOfScope).not.toHaveBeenCalled();
  });

  it('megvárja MINDEN interrupt() nyugtáját, mielőtt visszatér', async () => {
    const registry = createAgentQueryRegistry();
    // A `Promise<undefined>` illeszkedik az `AgentQuery.interrupt(): Promise<void>`
    // szignatúrára, és elkerüli a `no-invalid-void-type` szabályt.
    const { promise, resolve } = Promise.withResolvers<undefined>();
    registry.register(
      'run-1',
      'step-1',
      fakeQuery(() => promise),
    );

    let hasSettled = false;
    const call = (async (): Promise<void> => {
      await interruptLiveAgentQueries(new Set(['run-1']), registry);
      hasSettled = true;
    })();

    await Promise.resolve();
    await Promise.resolve();
    expect(hasSettled).toBe(false);

    resolve(undefined);
    await call;
    expect(hasSettled).toBe(true);
  });

  it('üres futás halmazra egyetlen interrupt() sem fut le', async () => {
    const registry = createAgentQueryRegistry();
    const interruptSpy = vi.fn(() => Promise.resolve());
    registry.register('run-1', 'step-1', fakeQuery(interruptSpy));

    await interruptLiveAgentQueries(new Set(), registry);

    expect(interruptSpy).not.toHaveBeenCalled();
  });
});
