import type { AgentStepConfig } from './agent-step-config.ts';
import type { ScriptConfig } from './script-config.ts';

/**
 * A `workflow_node.config` oszlop tartalma, node típusonként (SPEC-003 4.3
 * táblázat, "A `config` lényegi mezői" oszlop). Az unió diszkriminátora a
 * `type` mező: az oszlop és a config ugyanazt a `NodeType` értéket hordozza,
 * így a JSON önmagában is olvasható, és az `isNodeConfig` guard kimerítően
 * tudja ellenőrizni mind a tíz ágat.
 */

/**
 * A `start` node egy bemeneti mezője. A `valueKind` értékkészletét a SPEC-003
 * nem sorolja fel, ezért itt szabad szöveg marad; a felsorolás rögzítése külön
 * termékdöntés.
 */
export interface StartInputField {
  readonly name: string;
  readonly label: string;
  readonly valueKind: string;
  readonly required: boolean;
}

export interface StartNodeConfig {
  readonly type: 'start';
  readonly inputFields: readonly StartInputField[];
}

/**
A fő típus: egy agent futtatás, a 4.4 táblázat mezőivel.
*/
export interface AgentStepNodeConfig extends AgentStepConfig {
  readonly type: 'agent_step';
}

export interface BranchOption {
  readonly key: string;
  readonly label: string;
}

/**
Determinisztikus elágazás, NEM AI. A feltétel itt áll, nem az élen (4.7).
*/
export interface BranchNodeConfig {
  readonly type: 'branch';
  readonly expression: string;
  readonly branches: readonly BranchOption[];
  readonly defaultBranchKey: string | null;
}

export interface FanOutNodeConfig {
  readonly type: 'fan_out';
  readonly itemsExpression: string;
  readonly branchLabelTemplate: string;
}

/**
 * A `merge` mód alobjektuma: a bemenő ágak összefűzési szabálya. A SPEC-003
 * 4.3 egyetlen mezőjét sem nevezi meg, ezért a tárolt alak nyitott rekord
 * marad, és a typeguard is csak annyit követel meg, hogy objektum legyen.
 * Mezőt kitalálni tilos, a szabály rögzítése külön termékdöntés.
 */
export type JoinMergeSettings = Readonly<Record<string, unknown>>;

export interface JoinMergeNodeConfig {
  readonly type: 'join';
  readonly mode: 'merge';
  readonly settings: JoinMergeSettings;
}

export interface JoinScriptNodeConfig {
  readonly type: 'join';
  readonly mode: 'script';
  readonly settings: ScriptConfig;
}

/**
Az `ai_synthesis` mód teljes értékű agent lépés: az alobjektuma az `AgentStepConfig`.
*/
export interface JoinAiSynthesisNodeConfig {
  readonly type: 'join';
  readonly mode: 'ai_synthesis';
  readonly settings: AgentStepConfig;
}

/**
Ágak összezárása. Módonként egyetlen alobjektum áll, a `settings` kulcson.
*/
export type JoinNodeConfig = JoinMergeNodeConfig | JoinScriptNodeConfig | JoinAiSynthesisNodeConfig;

/**
A `maxIterations` kötelező, szállított alapérték nélkül (SPEC-003 4.3).
*/
export interface LoopNodeConfig {
  readonly type: 'loop';
  readonly maxIterations: number;
  readonly continueExpression: string;
}

export interface HumanApprovalNodeConfig {
  readonly type: 'human_approval';
  readonly title: string;
  readonly bodyTemplate: string;
}

/**
A `maxAttempts` és a `backoffMs` kötelező, szállított alapérték nélkül.
*/
export interface ErrorHandlerNodeConfig {
  readonly type: 'error_handler';
  readonly maxAttempts: number;
  readonly backoffMs: readonly number[];
  readonly handledErrorKinds: readonly string[];
}

export interface SubWorkflowNodeConfig {
  readonly type: 'sub_workflow';
  readonly targetWorkflowId: string;
  readonly inputMapping: Readonly<Record<string, string>>;
}

/**
Nem AI transzformáció. Tárolható, de a futás indítása elutasítja (4.3).
*/
export interface ScriptNodeConfig extends ScriptConfig {
  readonly type: 'script';
}

export type NodeConfig =
  | StartNodeConfig
  | AgentStepNodeConfig
  | BranchNodeConfig
  | FanOutNodeConfig
  | JoinNodeConfig
  | LoopNodeConfig
  | HumanApprovalNodeConfig
  | ErrorHandlerNodeConfig
  | SubWorkflowNodeConfig
  | ScriptNodeConfig;
