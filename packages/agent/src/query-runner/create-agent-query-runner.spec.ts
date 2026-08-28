import { describe, expect, it } from 'vitest';
import { isOkOutcome } from '@easter-workflow-builder/core';
import { createAgentQueryRunner } from './create-agent-query-runner.ts';
import type { AgentQueryRequest } from './agent-query-request.ts';
import type { SdkQueryFunction } from './sdk-query-function.ts';
import type { SdkQueryHandle } from './sdk-query-handle.ts';

const request: AgentQueryRequest = { prompt: 'ki vagy?', options: { model: 'teszt-modell' } };

interface FakeHandleLog {
  readonly interruptCalls: number[];
}

function createFakeHandle(messages: readonly unknown[], log: FakeHandleLog): SdkQueryHandle {
  return {
    [Symbol.asyncIterator](): AsyncIterator<unknown> {
      let index = 0;
      return {
        next(): Promise<IteratorResult<unknown>> {
          if (index === messages.length) {
            return Promise.resolve({ done: true, value: undefined });
          }
          const message = messages[index];
          index += 1;
          return Promise.resolve({ done: false, value: message });
        },
      };
    },
    interrupt(): Promise<unknown> {
      log.interruptCalls.push(log.interruptCalls.length);
      // A valódi SDK megszakítási nyugtát ad, nem `void` értéket: az adapter
      // dolga eldobni.
      return Promise.resolve({ still_queued: [] });
    },
  };
}

describe('createAgentQueryRunner', () => {
  it('továbbadja a kérést a befecskendezett SDK függvénynek', () => {
    const seen: Parameters<SdkQueryFunction>[0][] = [];
    const runner = createAgentQueryRunner((parameters) => {
      seen.push(parameters);
      return createFakeHandle([], { interruptCalls: [] });
    });

    runner.run(request);

    expect(seen).toStrictEqual([{ prompt: 'ki vagy?', options: { model: 'teszt-modell' } }]);
  });

  it('a kezelőt `messages` folyamként adja ki, sorrendhelyesen', async () => {
    const handle = createFakeHandle([{ type: 'system' }, { type: 'result' }], { interruptCalls: [] });
    const runner = createAgentQueryRunner(() => handle);

    const outcome = runner.run(request);
    if (!isOkOutcome(outcome)) {
      throw new Error('a hamis függvény nem dobott, tehát sikeres ágat vártunk');
    }

    expect(outcome.value.messages).toBe(handle);
    const iterator = outcome.value.messages[Symbol.asyncIterator]();
    await expect(iterator.next()).resolves.toStrictEqual({ done: false, value: { type: 'system' } });
    await expect(iterator.next()).resolves.toStrictEqual({ done: false, value: { type: 'result' } });
    await expect(iterator.next()).resolves.toStrictEqual({ done: true, value: undefined });
  });

  it('az `interrupt()` a kezelőre delegál, és eldobja a megszakítási nyugtát', async () => {
    const log: FakeHandleLog = { interruptCalls: [] };
    const runner = createAgentQueryRunner(() => createFakeHandle([], log));

    const outcome = runner.run(request);
    if (!isOkOutcome(outcome)) {
      throw new Error('a hamis függvény nem dobott, tehát sikeres ágat vártunk');
    }

    await expect(outcome.value.interrupt()).resolves.toBeUndefined();
    expect(log.interruptCalls).toStrictEqual([0]);
  });

  it('hibaágat ad, ha a befecskendezett SDK függvény kivételt dob', () => {
    const runner = createAgentQueryRunner(() => {
      throw new Error('a CLI nem indult el');
    });

    expect(runner.run(request)).toStrictEqual({
      kind: 'error',
      message: 'Az Agent SDK futtatás nem indult el: a CLI nem indult el',
    });
  });
});
