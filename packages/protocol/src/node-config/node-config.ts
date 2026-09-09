import { z } from 'zod';
import { AgentStepConfigSchema } from './agent-step-config.ts';
import { ScriptConfigSchema } from './script-config.ts';

/**
 * A `workflow_node.config` mezőjének drótszintű alakja, a `packages/db`
 * `node-config.ts` `NodeConfig` uniójának SZÁNDÉKOS mirror sémája (a `protocol`
 * L1 réteg a `db`-t (L2) nem importálhatja, SPEC-005 F-23, `.claude/CLAUDE.md`
 * 5. szekció "A `protocol` a `db` domain uniót is duplikálhatja..."). A
 * sodródás védelmét az `apps/server` regressziós tesztje adja (PLAN-009
 * T-009-13): típusszintű kétirányú egyenlőség plusz futásidejű ellenőrzés a
 * `db` `isNodeConfig` guardján.
 *
 * Mind a tíz ág `z.strictObject`, nincs alapérték- vagy transzformáló
 * séma-metódus hívás, minden kimenő alak `.readonly()`, az unió
 * `z.discriminatedUnion`
 * (SPEC-005 7.2, 7.3, 7.4). Az `AgentStepConfig.agents` és a
 * `JoinMergeNodeConfig.settings` alakja **nem szűkíthető**
 * `Record<string, unknown>`-nál szűkebbre, különben a `db` oldali,
 * szándékosan nyitott rekorddal szemben a típusszintű egyenlőség megbukna.
 */
export const UnhandledErrorPolicySchema = z.enum(['fail_run', 'fail_branch']);

export type UnhandledErrorPolicy = z.infer<typeof UnhandledErrorPolicySchema>;

export const StartInputFieldSchema = z
  .strictObject({
    name: z.string(),
    label: z.string(),
    valueKind: z.string(),
    required: z.boolean(),
  })
  .readonly();

export type StartInputField = z.infer<typeof StartInputFieldSchema>;

export const StartNodeConfigSchema = z
  .strictObject({
    type: z.literal('start'),
    inputFields: z.array(StartInputFieldSchema).readonly(),
    onUnhandledError: UnhandledErrorPolicySchema.nullable(),
  })
  .readonly();

export type StartNodeConfig = z.infer<typeof StartNodeConfigSchema>;

/**
 * A fő típus: egy agent futtatás. Az `onUnhandledError` itt, a node config
 * tetején áll, nem a megosztott `AgentStepConfigSchema` alakban (azt a
 * `join` `ai_synthesis` módja is használja, ahol nincs értelmezve) - ugyanaz
 * a mintázat, mint a `db` `AgentStepNodeConfig`-nál.
 */
export const AgentStepNodeConfigSchema = AgentStepConfigSchema.unwrap()
  .extend({
    type: z.literal('agent_step'),
    onUnhandledError: UnhandledErrorPolicySchema.nullable(),
  })
  .readonly();

export type AgentStepNodeConfig = z.infer<typeof AgentStepNodeConfigSchema>;

export const BranchOptionSchema = z
  .strictObject({
    key: z.string(),
    label: z.string(),
  })
  .readonly();

export type BranchOption = z.infer<typeof BranchOptionSchema>;

/**
 * Determinisztikus elágazás, NEM AI. A feltétel itt áll, nem az élen.
 */
export const BranchNodeConfigSchema = z
  .strictObject({
    type: z.literal('branch'),
    expression: z.string(),
    branches: z.array(BranchOptionSchema).readonly(),
    defaultBranchKey: z.string().nullable(),
    onUnhandledError: UnhandledErrorPolicySchema.nullable(),
  })
  .readonly();

export type BranchNodeConfig = z.infer<typeof BranchNodeConfigSchema>;

export const FanOutNodeConfigSchema = z
  .strictObject({
    type: z.literal('fan_out'),
    itemsExpression: z.string(),
    branchLabelTemplate: z.string(),
    onUnhandledError: UnhandledErrorPolicySchema.nullable(),
  })
  .readonly();

export type FanOutNodeConfig = z.infer<typeof FanOutNodeConfigSchema>;

/**
 * A `merge` mód alobjektuma: a bemenő ágak összefűzési szabálya. A `db`
 * `JoinMergeSettings` szándékosan nyitott rekord marad (mezőt kitalálni
 * tilos), a séma sem szűkíti szűkebbre.
 */
export const JoinMergeSettingsSchema = z.record(z.string(), z.unknown()).readonly();

export type JoinMergeSettings = z.infer<typeof JoinMergeSettingsSchema>;

export const JoinMergeNodeConfigSchema = z
  .strictObject({
    type: z.literal('join'),
    mode: z.literal('merge'),
    settings: JoinMergeSettingsSchema,
    onUnhandledError: UnhandledErrorPolicySchema.nullable(),
  })
  .readonly();

export type JoinMergeNodeConfig = z.infer<typeof JoinMergeNodeConfigSchema>;

export const JoinScriptNodeConfigSchema = z
  .strictObject({
    type: z.literal('join'),
    mode: z.literal('script'),
    settings: ScriptConfigSchema,
    onUnhandledError: UnhandledErrorPolicySchema.nullable(),
  })
  .readonly();

export type JoinScriptNodeConfig = z.infer<typeof JoinScriptNodeConfigSchema>;

/**
 * Az `ai_synthesis` mód teljes értékű agent lépés: az alobjektuma az
 * `AgentStepConfigSchema`. Az `onUnhandledError` itt, a join node config
 * tetején áll, nem a `settings` alobjektumban.
 */
export const JoinAiSynthesisNodeConfigSchema = z
  .strictObject({
    type: z.literal('join'),
    mode: z.literal('ai_synthesis'),
    settings: AgentStepConfigSchema,
    onUnhandledError: UnhandledErrorPolicySchema.nullable(),
  })
  .readonly();

export type JoinAiSynthesisNodeConfig = z.infer<typeof JoinAiSynthesisNodeConfigSchema>;

/**
 * Ágak összezárása. Módonként egyetlen alobjektum áll, a `settings` kulcson.
 * Beágyazott diszkriminált unió a `mode` mezőn, ami a külső, `type` mezőn
 * álló uniónak is érvényes tagja (mérve: mindhárom ág `type: 'join'`
 * literált hordoz, a Zod 4 ezt elfogadja beágyazott unió tagként).
 */
export const JoinNodeConfigSchema = z.discriminatedUnion('mode', [
  JoinMergeNodeConfigSchema,
  JoinScriptNodeConfigSchema,
  JoinAiSynthesisNodeConfigSchema,
]);

export type JoinNodeConfig = z.infer<typeof JoinNodeConfigSchema>;

/**
 * A `maxIterations` kötelező, szállított alapérték nélkül.
 */
export const LoopNodeConfigSchema = z
  .strictObject({
    type: z.literal('loop'),
    maxIterations: z.number(),
    continueExpression: z.string(),
    onUnhandledError: UnhandledErrorPolicySchema.nullable(),
  })
  .readonly();

export type LoopNodeConfig = z.infer<typeof LoopNodeConfigSchema>;

/**
 * A `timeoutMs` `null` értéke korlátlan várakozást jelent.
 */
export const HumanApprovalNodeConfigSchema = z
  .strictObject({
    type: z.literal('human_approval'),
    title: z.string(),
    bodyTemplate: z.string(),
    timeoutMs: z.number().nullable(),
    onUnhandledError: UnhandledErrorPolicySchema.nullable(),
  })
  .readonly();

export type HumanApprovalNodeConfig = z.infer<typeof HumanApprovalNodeConfigSchema>;

/**
 * A `maxAttempts` és a `backoffMs` kötelező, szállított alapérték nélkül.
 */
export const ErrorHandlerNodeConfigSchema = z
  .strictObject({
    type: z.literal('error_handler'),
    maxAttempts: z.number(),
    backoffMs: z.array(z.number()).readonly(),
    handledErrorKinds: z.array(z.string()).readonly(),
    onUnhandledError: UnhandledErrorPolicySchema.nullable(),
  })
  .readonly();

export type ErrorHandlerNodeConfig = z.infer<typeof ErrorHandlerNodeConfigSchema>;

export const SubWorkflowNodeConfigSchema = z
  .strictObject({
    type: z.literal('sub_workflow'),
    targetWorkflowId: z.string(),
    inputMapping: z.record(z.string(), z.string()).readonly(),
    onUnhandledError: UnhandledErrorPolicySchema.nullable(),
  })
  .readonly();

export type SubWorkflowNodeConfig = z.infer<typeof SubWorkflowNodeConfigSchema>;

/**
 * Nem AI transzformáció. Tárolható, de a futás indítása elutasítja.
 */
export const ScriptNodeConfigSchema = ScriptConfigSchema.unwrap()
  .extend({
    type: z.literal('script'),
    onUnhandledError: UnhandledErrorPolicySchema.nullable(),
  })
  .readonly();

export type ScriptNodeConfig = z.infer<typeof ScriptNodeConfigSchema>;

export const NodeConfigSchema = z.discriminatedUnion('type', [
  StartNodeConfigSchema,
  AgentStepNodeConfigSchema,
  BranchNodeConfigSchema,
  FanOutNodeConfigSchema,
  JoinNodeConfigSchema,
  LoopNodeConfigSchema,
  HumanApprovalNodeConfigSchema,
  ErrorHandlerNodeConfigSchema,
  SubWorkflowNodeConfigSchema,
  ScriptNodeConfigSchema,
]);

export type NodeConfig = z.infer<typeof NodeConfigSchema>;
