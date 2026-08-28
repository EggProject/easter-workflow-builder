import { describeError } from '@easter-workflow-builder/core';
import type { Outcome } from '@easter-workflow-builder/core';
import type { AgentQuery } from './agent-query.ts';
import type { AgentQueryRequest } from './agent-query-request.ts';
import type { AgentQueryRunner } from './agent-query-runner.ts';
import type { SdkQueryFunction } from './sdk-query-function.ts';
import type { SdkQueryHandle } from './sdk-query-handle.ts';

/**
 * Az Agent SDK adapter: a `query()` függvényt **paraméterként** kapja, nem
 * importálja. Ettől a teszt valós API hívás nélkül fedi minden ágát, és a
 * csomag futásidejű modulgráfjában nincs benne az SDK.
 *
 * Két dolgot tesz, semmi mást: kivételt `Outcome` hibaággá alakít, és a kezelő
 * `interrupt()` nyugtáját eldobva `Promise<void>` alakra szűkít.
 */
export function createAgentQueryRunner(sdkQuery: SdkQueryFunction): AgentQueryRunner {
  return {
    run(request: AgentQueryRequest): Outcome<AgentQuery> {
      let handle: SdkQueryHandle;
      try {
        handle = sdkQuery({ prompt: request.prompt, options: request.options });
      } catch (error) {
        return { kind: 'error', message: `Az Agent SDK futtatás nem indult el: ${describeError(error)}` };
      }
      return {
        kind: 'ok',
        value: {
          messages: handle,
          interrupt: async (): Promise<void> => {
            await handle.interrupt();
          },
        },
      };
    },
  };
}
