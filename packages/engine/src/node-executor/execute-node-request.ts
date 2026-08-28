import type { ErrorHandlerNodeConfig } from '@easter-workflow-builder/db';
import type { ProviderCapabilityDescriptor } from '@easter-workflow-builder/provider-capability';
import type { SessionBearingInstance } from '../agent-step/session-bearing-instance.ts';
import type { SessionSourceNodes } from '../agent-step/session-source-nodes.ts';
import type { EngineErrorKind } from '../engine-error/engine-error-kind.ts';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import type { ExecutedStepInstance } from '../run-context/executed-step-instance.ts';
import type { RunContext } from '../run-context/run-context.ts';
import type { ExecutableNodeConfig } from '../run-validation/executable-node-config.ts';
import type { NodeExecutionInstance } from './node-executor-instance.ts';

/**
 * Minden node típus minden lehetséges bemenete egy helyen. A diszpécser
 * (`executeNode`) ágai ebből csak azt olvassák ki, amit az adott `execute-*`
 * függvény ténylegesen kér; a hívó (`run-supervisor`, T-005-25) mindegyiket
 * elő tudja állítani, mert mind a tíz mező a futás állapotából származik:
 *
 * - `instance`: a `step_run` sorhoz kötött szerkezeti adatok (SPEC-004 4.3).
 * - `config`: a **validált**, szűkített node config (4.7).
 * - `runContext`: a kifejezés és a sablon port kontextusa (6.1).
 * - `graph`, `executedInstances`: a hivatkozás feloldás bemenetei (6.2), a
 *   `sub_workflow` `inputMapping` mezőjéhez.
 * - `runInput`: a futás bemenete, a `start` node kimenete (5. szekció 1. sora).
 * - `availableBranchKeys`: a node ténylegesen bekötött, `on_error`-tól
 *   különböző kimenő éleinek `branch_key` értéke (`execute-branch.ts`).
 * - `joinInputs`: a beérkezett ág kimenetek, elem sorrendben
 *   (`collectJoinInputs`, 5.6). Nem `join` node-nál üres lista: nem kitalált
 *   érték, hanem a "nem érkezett be egyetlen ág sem" tényleges alakja, amit
 *   az adott ág úgysem olvas.
 * - `descriptor`: a **feloldott** provider leíró (11.1, 11.2).
 * - `sessionSourceNodes`, `sessionInstances`: a session kötés bemenetei
 *   (6.3, 6.4).
 */
interface ExecuteNodeCommonFields {
  readonly instance: NodeExecutionInstance;
  readonly runContext: RunContext;
  readonly graph: ExecutableGraph;
  readonly executedInstances: readonly ExecutedStepInstance[];
  readonly runInput: unknown;
  readonly availableBranchKeys: readonly string[];
  readonly joinInputs: readonly unknown[];
  readonly descriptor: ProviderCapabilityDescriptor<string, string>;
  readonly sessionSourceNodes: SessionSourceNodes;
  readonly sessionInstances: readonly SessionBearingInstance[];
}

/**
 * A diszpécser bemenete, **két tagú diszkriminált unió** a `kind` mezőn.
 *
 * **Miért van egyáltalán diszkrimináns a `config.type` mellett.** Az
 * `error_handler` node az egyetlen, aminek a végrehajtásához a node
 * configján és a példány adatain kívül a **hibát adó másik lépés** két adata
 * is kell (`failedErrorKind`, `failedAttempt`, SPEC-004 8.2 bevezető). Ha ez
 * a két mező a közös részben állna, opcionális lenne, és a diszpécser
 * `error_handler` ágának egy olyan hiányzó-érték ágat kellene kezelnie, ami a
 * hívási szerződés szerint sosem fordul elő. A TypeScript viszont **nem szűkít beágyazott diszkriminánsra**
 * (`request.config.type` a `request` unióját nem szűkíti, a fordító
 * ténylegesen `TS2339` hibát ad), ezért a diszkriminánsnak a legfelső szinten
 * kell állnia. Így a három mező típusszinten kötelező pontosan ott, ahol
 * kell, és sehol máshol nem létezik.
 *
 * A `node` ág configja ezért `ErrorHandlerNodeConfig` nélküli unió: a
 * diszpécser `switch(config.type)` szerkezete kilenc ágat fed le (a `join`
 * két módjával), és kimerítő marad a `switch-exhaustiveness-check` szabály
 * alatt.
 */
export type ExecuteNodeRequest =
  | (ExecuteNodeCommonFields & {
      readonly kind: 'node';
      readonly config: Exclude<ExecutableNodeConfig, ErrorHandlerNodeConfig>;
    })
  | (ExecuteNodeCommonFields & {
      readonly kind: 'error_handler';
      readonly config: ErrorHandlerNodeConfig;
      readonly failedErrorKind: EngineErrorKind;
      readonly failedAttempt: number;
    });
