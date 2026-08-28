import type { DatabaseContext } from '../engine-port/database-port.ts';
import type { ClockPort } from '../engine-port/clock-port.ts';
import type { IdGeneratorPort } from '../engine-port/id-generator-port.ts';
import type { EventPublisherPort } from '../engine-port/event-publisher-port.ts';
import type { ExpressionEvaluatorPort } from '../engine-port/expression-evaluator-port.ts';
import type { TemplateRendererPort } from '../engine-port/template-renderer-port.ts';

/**
 * A hat port, amit mind az öt (a `T-005-21`-ben pedig még kettő) node
 * végrehajtó megkap (SPEC-004 5. szekció "Közös szabályok minden
 * végrehajtóra"): a `database` a `step_run` sor létrehozásához és
 * állapotváltásához, a `clock` az időbélyegekhez (`step_started`/
 * `step_finished` `occurredAtMs`, `step_finished.durationMs`), az
 * `idGenerator` a jövőbeli végrehajtók (`human_approval`, `sub_workflow`)
 * azonosító igényéhez, az `eventPublisher` a motor esemény élő kiadásához, az
 * `expressionEvaluator` a `branch`/`fan_out`/`loop` kifejezéseihez, a
 * `templateRenderer` a `fan_out` `branchLabelTemplate` mezőjéhez.
 *
 * Ez a bemeneti típus egy külön, megosztott struktúra, hogy az öt (majd
 * tizenegy) `execute-*` függvény paraméterlistája ne duplikálja ugyanazt a hat
 * mezőt (`.claude/CLAUDE.md` 5. szekció "Egyszerűség és sebészi
 * változtatás"). Az `EngineDependencies` (3.2 szekció) ennél kilenc portot
 * hordoz; ez a téma csak azt a hatot veszi át, amit ténylegesen használ.
 */
export interface NodeExecutorPorts {
  readonly database: DatabaseContext;
  readonly clock: ClockPort;
  readonly idGenerator: IdGeneratorPort;
  readonly eventPublisher: EventPublisherPort;
  readonly expressionEvaluator: ExpressionEvaluatorPort;
  readonly templateRenderer: TemplateRendererPort;
}
