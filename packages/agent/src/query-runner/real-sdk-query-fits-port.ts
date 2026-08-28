import type { query } from '@anthropic-ai/claude-agent-sdk';
import type { SdkQueryFunction } from './sdk-query-function.ts';

/**
 * Fordítási idejű őr: a pinelt Agent SDK valódi `query()` függvénye
 * hozzárendelhető az `SdkQueryFunction` alakhoz, tehát az `apps/server`
 * összeállításnak nem kell semmit áthidalnia.
 *
 * A `TFits` alapértéke a tényleges illeszkedés, a megszorítása `true`. Ha egy
 * SDK frissítés az illeszkedést elrontja, az alapérték `false` lesz, ami nem
 * elégíti ki a megszorítást, és a `bun run typecheck` kapu **itt** bukik, nem
 * az összeállításnál. A típusnak nincs futásidejű megfelelője, ezért nem
 * szerepel a barrelben.
 */
export type RealSdkQueryFitsPort<TFits extends true = typeof query extends SdkQueryFunction ? true : false> = TFits;
