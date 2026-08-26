import type { EnvironmentReader } from '../config/environment-reader.ts';
import type { FetchFunction } from '../http/fetch-function.ts';
import type { ReadFileFunction } from '../image/read-file-function.ts';

/**
 * Az eszközök futásidejű függőségei. Mindhárom befecskendezhető, hogy a unit
 * teszt hálózat és lemez nélkül is le tudja fedni minden ágat.
 */
export interface AgentToolDependencies {
  readonly fetchFunction: FetchFunction;
  readonly environment: EnvironmentReader;
  readonly readFileFunction: ReadFileFunction;
}
