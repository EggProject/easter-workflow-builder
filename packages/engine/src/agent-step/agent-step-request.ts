import type { AgentStepConfig } from '@easter-workflow-builder/db';
import type { ProviderCapabilityDescriptor } from '@easter-workflow-builder/provider-capability';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import type { RunContext } from '../run-context/run-context.ts';
import type { StepInstanceReference } from '../run-context/step-instance-reference.ts';
import type { AgentStepCapabilityDecisions } from './agent-step-capability-decisions.ts';
import type { SessionBearingInstance } from './session-bearing-instance.ts';
import type { SessionSourceNodes } from './session-source-nodes.ts';

/**
 * Egy agent lépés futtatásának teljes bemenete (SPEC-004 5.2).
 *
 * - `runId`, `stepRunId`: a már **létrehozott és `running` állapotba vitt**
 *   lépés futás azonosítói. A `createStepRun`, a `markStepRunning` és a
 *   `step_started` esemény a végrehajtó réteg közös kerete (5. szekció közös
 *   szabályai), nem ezé a témáé.
 * - `instance`: a node példány azonosítója (4.3), a session feloldás ág
 *   kontextus feltételéhez.
 * - `config`: a lépés `AgentStepConfig` alakja. Az `ai_synthesis` módú `join`
 *   node esetén ez a `settings` alobjektum, tehát a téma nem tud arról, hogy
 *   `agent_step` vagy `join` node fut (5.6).
 * - `decisions`: a leírótól függő döntések, amiket a hívó a
 *   `validateAgentStepCapabilities` függvénnyel számol ki. **Miért bemenet:**
 *   a `step_started` esemény három `unproven` jelölője ezekből jön, és az az
 *   esemény a futtatás **előtt**, a `running` állapotba lépéskor íródik
 *   (13. szekció), tehát a döntéseknek addigra készen kell lenniük.
 * - `descriptor`: a feloldott provider leírójából az a két mező, amit ez a
 *   futtatás ténylegesen olvas: a kötelező és a tiltott env változók
 *   (11.3 táblázat 10. és 11. sora). A leíró többi mezője már fel van
 *   dolgozva a `decisions` értékben, ezért nem kell újra átadni; a `Pick` alak
 *   így maga dokumentálja, mit olvas a motor a leíróból (11.3 "Amit a motor a
 *   leíróból szándékosan NEM olvas" táblázata). A teljes leíró átadható, mert
 *   illeszkedik erre az alakra.
 * - `runContext`: a prompt sablon kiértékelési kontextusa (6.1), amit a
 *   `run-context` téma állít össze.
 * - `graph`, `sessionSourceNodes`, `sessionInstances`: a session kötés
 *   feloldásának bemenetei (6.3, 6.4).
 */
export interface AgentStepRequest {
  readonly runId: string;
  readonly stepRunId: string;
  readonly instance: StepInstanceReference;
  readonly config: AgentStepConfig;
  readonly decisions: AgentStepCapabilityDecisions;
  readonly descriptor: Pick<ProviderCapabilityDescriptor<string, string>, 'requiredEnv' | 'disallowedEnv'>;
  readonly runContext: RunContext;
  readonly graph: ExecutableGraph;
  readonly sessionSourceNodes: SessionSourceNodes;
  readonly sessionInstances: readonly SessionBearingInstance[];
}
