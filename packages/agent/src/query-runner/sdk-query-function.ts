import type { SdkQueryHandle } from './sdk-query-handle.ts';

/**
 * A `createAgentQueryRunner` befecskendezett paraméterének típusa: az Agent SDK
 * `query()` függvényének **port-kompatibilis alakja**, nem maga a `typeof query`.
 *
 * Az alak úgy van megválasztva, hogy a pinelt SDK valódi `query()` függvénye
 * hozzárendelhető legyen hozzá. Ez nem feltételezés, hanem mért tény: a
 * `create-agent-query-runner.spec.ts` fordítási idejű ellenőrzése bukik, ha egy
 * SDK frissítés ezt elrontaná. A mérés két meglepő részlete, amit érdemes tudni:
 *
 * 1. A `Readonly<Record<string, unknown>>` **átadható** az SDK `Options`
 *    paraméterének. Az `Options` minden mezője opcionális, és a TypeScript egy
 *    string index szignatúrás forrást ilyen célnál elfogad (`exactOptionalPropertyTypes`
 *    mellett is). Tehát az `options` port típusa nem igényel `as` kényszerítést.
 * 2. Az SDK `Query` visszatérési típusa mégsem használható közvetlenül a port
 *    paraméterében: lásd az `SdkQueryHandle` indoklását.
 *
 * Az elvetett alternatíva a `typeof query` közvetlen paraméterként való
 * használata volt. Azért esett ki, mert a teszt hamis függvényének a teljes SDK
 * `Query` felületét meg kellene valósítania, `as` nélkül, ami a valós API hívás
 * tilalma mellett aránytalan. A valódi `query()` bekötése az `apps/server`
 * összeállítás dolga (SPEC-004 1. és 3.1), és a fenti 1. pont miatt sima
 * értékadás.
 */
export type SdkQueryFunction = (parameters: {
  readonly prompt: string;
  readonly options: Readonly<Record<string, unknown>>;
}) => SdkQueryHandle;
