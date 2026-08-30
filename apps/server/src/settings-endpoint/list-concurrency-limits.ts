import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { Engine } from '@easter-workflow-builder/engine';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';
import { toConcurrencyLimitView } from './to-concurrency-limit-view.ts';

/**
 * `GET /api/settings/concurrency-limits` (SPEC-005 4.2 E táblázat 23.
 * sora). A két rögzített provider mindegyikére épít egy nézetet, NÉVVEL
 * címezve, nem `Object.keys` iterációval - ugyanaz a minta, mint a
 * `provider-endpoint/list-providers.ts`-ben.
 */
export function createListConcurrencyLimitsHandler(database: DatabaseContext, engine: Engine): RouteHandler {
  return () => {
    const limits = database.concurrencyLimits.readAllLimits();
    if (limits.kind === 'error') {
      return Promise.resolve(limits);
    }

    const body = [
      // eslint-disable-next-line unicorn/no-null -- a toConcurrencyLimitView bemenete valódi number | null
      toConcurrencyLimitView('claude-subscription', limits.value.get('claude-subscription') ?? null, engine),
      // eslint-disable-next-line unicorn/no-null -- lásd fent
      toConcurrencyLimitView('minimax', limits.value.get('minimax') ?? null, engine),
    ];

    return Promise.resolve({ kind: 'ok', value: { status: 200, body } });
  };
}
