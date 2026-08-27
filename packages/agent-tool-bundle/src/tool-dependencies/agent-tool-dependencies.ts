import type { EnvironmentReader, FetchFunction, ReadFileFunction } from '@easter-workflow-builder/core';

/**
 * Az eszközök futásidejű függőségei. Mindhárom befecskendezhető, hogy a unit
 * teszt hálózat és lemez nélkül is le tudja fedni minden ágat.
 */
export interface AgentToolDependencies {
  readonly fetchFunction: FetchFunction;
  readonly environment: EnvironmentReader;
  readonly readFileFunction: ReadFileFunction;
}
