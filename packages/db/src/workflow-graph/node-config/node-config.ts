import type { AgentStepConfig } from '../agent-step-config/agent-step-config.ts';
import type { ScriptConfig } from './script-config.ts';

/**
 * A `workflow_node.config` oszlop tartalma, node típusonként (SPEC-003 4.3
 * táblázat, "A `config` lényegi mezői" oszlop). Az unió diszkriminátora a
 * `type` mező: az oszlop és a config ugyanazt a `NodeType` értéket hordozza,
 * így a JSON önmagában is olvasható, és az `isNodeConfig` guard kimerítően
 * tudja ellenőrizni mind a tíz ágat.
 */

/**
 * A user 1. döntése (SPEC-004 8.3): kezeletlen hiba esetén a futás áll le
 * (`fail_run`), vagy csak az adott ág hal el (`fail_branch`).
 */
export type UnhandledErrorPolicy = 'fail_run' | 'fail_branch';

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
  readonly onUnhandledError: UnhandledErrorPolicy | null;
}

/**
A fő típus: egy agent futtatás, a 4.4 táblázat mezőivel. Az `onUnhandledError`
itt, a node config tetején áll, nem a megosztott `AgentStepConfig` alakban
(azt a `join` `ai_synthesis` módja is használja, ahol nincs értelmezve).
*/
export interface AgentStepNodeConfig extends AgentStepConfig {
  readonly type: 'agent_step';
  readonly onUnhandledError: UnhandledErrorPolicy | null;
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
  readonly onUnhandledError: UnhandledErrorPolicy | null;
}

export interface FanOutNodeConfig {
  readonly type: 'fan_out';
  readonly itemsExpression: string;
  readonly branchLabelTemplate: string;
  readonly onUnhandledError: UnhandledErrorPolicy | null;
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
  readonly onUnhandledError: UnhandledErrorPolicy | null;
}

export interface JoinScriptNodeConfig {
  readonly type: 'join';
  readonly mode: 'script';
  readonly settings: ScriptConfig;
  readonly onUnhandledError: UnhandledErrorPolicy | null;
}

/**
Az `ai_synthesis` mód teljes értékű agent lépés: az alobjektuma az `AgentStepConfig`.
Az `onUnhandledError` itt, a join node config tetején áll, nem a `settings`
alobjektumban.
*/
export interface JoinAiSynthesisNodeConfig {
  readonly type: 'join';
  readonly mode: 'ai_synthesis';
  readonly settings: AgentStepConfig;
  readonly onUnhandledError: UnhandledErrorPolicy | null;
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
  readonly onUnhandledError: UnhandledErrorPolicy | null;
}

/**
A `timeoutMs` `null` értéke korlátlan várakozást jelent, ez a szállított alak
(SPEC-004 5.8): időkorlát értékre nincs sem mérésünk, sem dokumentált
szabályunk, tehát számot nem adunk.
*/
export interface HumanApprovalNodeConfig {
  readonly type: 'human_approval';
  readonly title: string;
  readonly bodyTemplate: string;
  readonly timeoutMs: number | null;
  readonly onUnhandledError: UnhandledErrorPolicy | null;
}

/**
A `maxAttempts` és a `backoffMs` kötelező, szállított alapérték nélkül.
*/
export interface ErrorHandlerNodeConfig {
  readonly type: 'error_handler';
  readonly maxAttempts: number;
  readonly backoffMs: readonly number[];
  readonly handledErrorKinds: readonly string[];
  readonly onUnhandledError: UnhandledErrorPolicy | null;
}

export interface SubWorkflowNodeConfig {
  readonly type: 'sub_workflow';
  readonly targetWorkflowId: string;
  readonly inputMapping: Readonly<Record<string, string>>;
  readonly onUnhandledError: UnhandledErrorPolicy | null;
}

/**
Nem AI transzformáció. Tárolható, de a futás indítása elutasítja (4.3).
*/
export interface ScriptNodeConfig extends ScriptConfig {
  readonly type: 'script';
  readonly onUnhandledError: UnhandledErrorPolicy | null;
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
