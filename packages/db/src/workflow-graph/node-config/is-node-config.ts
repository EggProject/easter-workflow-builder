import {
  isBoolean,
  isInt,
  isNumber,
  isRecord,
  isRecordWithKnownKeys,
  isString,
  isStringArray,
} from '@easter-workflow-builder/typeguards';
import type {
  AgentStepNodeConfig,
  BranchNodeConfig,
  BranchOption,
  ErrorHandlerNodeConfig,
  ExpressionScriptNodeConfig,
  FanOutNodeConfig,
  HumanApprovalNodeConfig,
  JoinAiSynthesisNodeConfig,
  JoinMergeNodeConfig,
  JoinScriptNodeConfig,
  JavaScriptScriptNodeConfig,
  JoinUnselectedNodeConfig,
  LoopNodeConfig,
  NodeConfig,
  StartChoiceInputField,
  StartInputField,
  StartNodeConfig,
  StartPlainInputField,
  SubWorkflowNodeConfig,
  UnhandledErrorPolicy,
} from './node-config.ts';
import type { ExpressionScriptConfig } from './expression-script-config.ts';
import type { JavaScriptScriptConfig } from './javascript-script-config.ts';
import { MAX_SCRIPT_MEMORY_LIMIT_MB } from './max-script-memory-limit-mb.ts';
import { MAX_SCRIPT_TIMEOUT_MS } from './max-script-timeout-ms.ts';
import { MIN_SCRIPT_MEMORY_LIMIT_MB } from './min-script-memory-limit-mb.ts';
import type { ScriptConfig } from './script-config.ts';
import type { AgentStepConfig } from '../agent-step-config/agent-step-config.ts';
import { isAgentStepConfig } from '../agent-step-config/is-agent-step-config.ts';
import { isStartInputValueKind } from './is-start-input-value-kind.ts';
import { isNodeType } from '../node-type/is-node-type.ts';

type UnknownRecord = Readonly<Record<string, unknown>>;

// Az ellenőrzött objektumok zárt kulcslistái (SPEC-011 5.2): minden más kulcs
// ismeretlen, és a guard elutasítja. A `Record<keyof T, true>` annotáció miatt
// a fordító hibát ad, ha a típus egy mezővel bővül, de a lista nem. Ami szabad
// marad: a `sub_workflow` `inputMapping` kulcsai (nyitott rekord a típusban).
const START_NODE_CONFIG_KEYS: Readonly<Record<keyof StartNodeConfig, true>> = {
  type: true,
  inputFields: true,
  onUnhandledError: true,
};

const START_PLAIN_INPUT_FIELD_KEYS: Readonly<Record<keyof StartPlainInputField, true>> = {
  name: true,
  label: true,
  valueKind: true,
  required: true,
};

const START_CHOICE_INPUT_FIELD_KEYS: Readonly<Record<keyof StartChoiceInputField, true>> = {
  name: true,
  label: true,
  valueKind: true,
  options: true,
  required: true,
};

const BRANCH_NODE_CONFIG_KEYS: Readonly<Record<keyof BranchNodeConfig, true>> = {
  type: true,
  expression: true,
  branches: true,
  defaultBranchKey: true,
  onUnhandledError: true,
};

const BRANCH_OPTION_KEYS: Readonly<Record<keyof BranchOption, true>> = {
  key: true,
  label: true,
};

const FAN_OUT_NODE_CONFIG_KEYS: Readonly<Record<keyof FanOutNodeConfig, true>> = {
  type: true,
  itemsExpression: true,
  branchLabelTemplate: true,
  onUnhandledError: true,
};

const JOIN_MERGE_NODE_CONFIG_KEYS: Readonly<Record<keyof JoinMergeNodeConfig, true>> = {
  type: true,
  mode: true,
  onUnhandledError: true,
};

const JOIN_SCRIPT_NODE_CONFIG_KEYS: Readonly<Record<keyof JoinScriptNodeConfig, true>> = {
  type: true,
  mode: true,
  settings: true,
  onUnhandledError: true,
};

const JOIN_AI_SYNTHESIS_NODE_CONFIG_KEYS: Readonly<Record<keyof JoinAiSynthesisNodeConfig, true>> = {
  type: true,
  mode: true,
  settings: true,
  onUnhandledError: true,
};

const JOIN_UNSELECTED_NODE_CONFIG_KEYS: Readonly<Record<keyof JoinUnselectedNodeConfig, true>> = {
  type: true,
  mode: true,
  onUnhandledError: true,
};

const LOOP_NODE_CONFIG_KEYS: Readonly<Record<keyof LoopNodeConfig, true>> = {
  type: true,
  maxIterations: true,
  continueExpression: true,
  onUnhandledError: true,
};

const HUMAN_APPROVAL_NODE_CONFIG_KEYS: Readonly<Record<keyof HumanApprovalNodeConfig, true>> = {
  type: true,
  title: true,
  bodyTemplate: true,
  timeoutMs: true,
  onUnhandledError: true,
};

const ERROR_HANDLER_NODE_CONFIG_KEYS: Readonly<Record<keyof ErrorHandlerNodeConfig, true>> = {
  type: true,
  maxAttempts: true,
  backoffMs: true,
  handledErrorKinds: true,
  onUnhandledError: true,
};

const SUB_WORKFLOW_NODE_CONFIG_KEYS: Readonly<Record<keyof SubWorkflowNodeConfig, true>> = {
  type: true,
  targetWorkflowId: true,
  inputMapping: true,
  onUnhandledError: true,
};

const EXPRESSION_SCRIPT_CONFIG_KEYS: Readonly<Record<keyof ExpressionScriptConfig, true>> = {
  source: true,
  runtime: true,
};

const JAVASCRIPT_SCRIPT_CONFIG_KEYS: Readonly<Record<keyof JavaScriptScriptConfig, true>> = {
  source: true,
  runtime: true,
  timeoutMs: true,
  cwd: true,
  memoryLimitMb: true,
};

const EXPRESSION_SCRIPT_NODE_CONFIG_KEYS: Readonly<Record<keyof ExpressionScriptNodeConfig, true>> = {
  type: true,
  source: true,
  runtime: true,
  onUnhandledError: true,
};

const JAVASCRIPT_SCRIPT_NODE_CONFIG_KEYS: Readonly<Record<keyof JavaScriptScriptNodeConfig, true>> = {
  type: true,
  source: true,
  runtime: true,
  timeoutMs: true,
  cwd: true,
  memoryLimitMb: true,
  onUnhandledError: true,
};

/**
 * Az `agent_step` node burkolata: a kulcsok, amik a node configon állnak, de a
 * megosztott `AgentStepConfig` alakban nem. A típus a két interfész kulcsainak
 * különbsége, tehát egy új burkoló mezőnél a fordító jelez.
 */
const AGENT_STEP_NODE_ENVELOPE_KEYS: Readonly<Record<Exclude<keyof AgentStepNodeConfig, keyof AgentStepConfig>, true>> =
  {
    type: true,
    onUnhandledError: true,
  };

/**
 * Az `agent_step` node configja a burkoló kulcsok nélkül: ez az a rész, amit az
 * `isAgentStepConfig` a saját zárt kulcslistájával ellenőriz, így a burkolón
 * kívüli ismeretlen kulcs ott bukik el.
 */
function withoutAgentStepNodeEnvelope(value: UnknownRecord): UnknownRecord {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !Object.hasOwn(AGENT_STEP_NODE_ENVELOPE_KEYS, key)),
  );
}

/**
 * Iterációszám és retry darabszám: a SPEC-003 4.3 szerint az egyetlen séma
 * szintű megkötés, ami definíció szerint igaz, hogy az érték egész és pozitív.
 * Alapértéket a spec kifejezetten nem szállít, ezért a guard sem pótol.
 */
function isPositiveInteger(value: unknown): value is number {
  return isInt(value) && value > 0;
}

/**
 * A JavaScript szkript időkorlátja (SPEC-014 5.3): `null` az alapérték, egyébként
 * pozitív egész legfeljebb `MAX_SCRIPT_TIMEOUT_MS`. Alsó határt nem ad, mert a
 * pozitív egész szabály a projekt minden időkorlát mezőjén ugyanaz.
 */
function isScriptTimeoutMs(value: unknown): value is number | null {
  return value === null || (isPositiveInteger(value) && value <= MAX_SCRIPT_TIMEOUT_MS);
}

/**
 * A JavaScript szkript memória korlátja (SPEC-014 5.3): `null` az alapérték,
 * egyébként egész, `MIN_SCRIPT_MEMORY_LIMIT_MB` és `MAX_SCRIPT_MEMORY_LIMIT_MB`
 * között (mindkét határ megengedett; a határok forrása a research Q-9).
 */
function isScriptMemoryLimitMb(value: unknown): value is number | null {
  return value === null || (isInt(value) && value >= MIN_SCRIPT_MEMORY_LIMIT_MB && value <= MAX_SCRIPT_MEMORY_LIMIT_MB);
}

/**
 * A user 1. döntése (SPEC-004 8.3): a node config `onUnhandledError` mezője.
 */
function isUnhandledErrorPolicy(value: unknown): value is UnhandledErrorPolicy {
  return value === 'fail_run' || value === 'fail_branch';
}

/**
 * A `null` a "nincs beállítva" állapot (SPEC-004 8.3): a futás indítási
 * validáció utasítja el, itt csak a tárolt alakot ellenőrizzük.
 */
function isNullableUnhandledErrorPolicy(value: unknown): value is UnhandledErrorPolicy | null {
  return value === null || isUnhandledErrorPolicy(value);
}

function isStringRecord(value: unknown): value is Readonly<Record<string, string>> {
  return isRecord(value) && Object.values(value).every((entry: unknown) => isString(entry));
}

/**
 * A `ScriptConfig` alak, a `runtime` szerinti ág zárt kulcslistájával, amit a
 * hívó ad meg: a `join` `script` módjának `settings` alobjektuma a két ág saját
 * kulcsaival, a `script` node a burkolóval (`type`, `onUnhandledError`) bővített
 * listákkal hívja. Ismeretlen `runtime` értékre a guard hamisat ad.
 */
function isScriptConfig(
  value: unknown,
  expressionKeys: Readonly<Record<string, true>>,
  javascriptKeys: Readonly<Record<string, true>>,
): value is ScriptConfig {
  if (!isRecord(value) || !isString(value['source'])) {
    return false;
  }
  switch (value['runtime']) {
    case 'expression': {
      return isRecordWithKnownKeys(value, expressionKeys);
    }
    case 'javascript': {
      return (
        isRecordWithKnownKeys(value, javascriptKeys) &&
        isScriptTimeoutMs(value['timeoutMs']) &&
        (value['cwd'] === null || isString(value['cwd'])) &&
        isScriptMemoryLimitMb(value['memoryLimitMb'])
      );
    }
    default: {
      return false;
    }
  }
}

/**
 * A `choice` opciói (SPEC-016 5.3): nem üres lista, minden elem nem üres
 * (`trim()` után sem) szöveg, az elemek egyediek. Írás és olvasás úton egyaránt
 * fut, mert a `valueKind` zárt felsorolása is minden úton szigorú (SPEC-016
 * 5.2, O-2); a `protocol` mentési sémája szándékosan duplikálja.
 */
function isChoiceOptions(value: unknown): value is readonly string[] {
  return (
    isStringArray(value) &&
    value.length > 0 &&
    value.every((option) => option.trim() !== '') &&
    new Set(value).size === value.length
  );
}

/**
 * A két ág közös mezői: a `name`, a `label` és a `required`.
 */
function hasStartInputFieldBase(value: Readonly<Partial<Record<'name' | 'label' | 'required', unknown>>>): boolean {
  return isString(value.name) && isString(value.label) && isBoolean(value.required);
}

/**
 * A bemeneti mező a `valueKind` szerinti diszkriminált unió (SPEC-016 5.3): a
 * `choice` ág zárt kulcslistája az `options` mezőt is tartalmazza, a többi ágé
 * nem, tehát `options` egy másik ágon ismeretlen kulcsként bukik.
 */
function isStartInputField(value: unknown): value is StartInputField {
  if (!isRecord(value) || !isStartInputValueKind(value['valueKind'])) {
    return false;
  }
  if (value['valueKind'] === 'choice') {
    return (
      isRecordWithKnownKeys(value, START_CHOICE_INPUT_FIELD_KEYS) &&
      hasStartInputFieldBase(value) &&
      isChoiceOptions(value.options)
    );
  }
  return isRecordWithKnownKeys(value, START_PLAIN_INPUT_FIELD_KEYS) && hasStartInputFieldBase(value);
}

function isStartConfig(value: UnknownRecord): boolean {
  const inputFields = value['inputFields'];
  return (
    isRecordWithKnownKeys(value, START_NODE_CONFIG_KEYS) &&
    Array.isArray(inputFields) &&
    inputFields.every((field: unknown) => isStartInputField(field)) &&
    isNullableUnhandledErrorPolicy(value.onUnhandledError)
  );
}

function isBranchOption(value: unknown): value is BranchOption {
  return isRecordWithKnownKeys(value, BRANCH_OPTION_KEYS) && isString(value.key) && isString(value.label);
}

function isBranchConfig(value: UnknownRecord): boolean {
  const branches = value['branches'];
  const defaultBranchKey = value['defaultBranchKey'];
  return (
    isRecordWithKnownKeys(value, BRANCH_NODE_CONFIG_KEYS) &&
    isString(value.expression) &&
    Array.isArray(branches) &&
    branches.every((option: unknown) => isBranchOption(option)) &&
    (defaultBranchKey === null || isString(defaultBranchKey)) &&
    isNullableUnhandledErrorPolicy(value.onUnhandledError)
  );
}

function isFanOutConfig(value: UnknownRecord): boolean {
  return (
    isRecordWithKnownKeys(value, FAN_OUT_NODE_CONFIG_KEYS) &&
    isString(value.itemsExpression) &&
    isString(value.branchLabelTemplate) &&
    isNullableUnhandledErrorPolicy(value.onUnhandledError)
  );
}

/**
 * A `join` három módja és a választatlan ág. Az `ai_synthesis` alobjektuma
 * pontosan az `AgentStepConfig`, a `script` módé ugyanaz a `ScriptConfig`,
 * mint a `script` node-é. A `merge` módnak és a `mode: null` ágnak nincs
 * `settings` mezője, tehát náluk csak az `onUnhandledError` érvényessége dönt
 * (SPEC-008 5.4, O-33).
 */
function isJoinConfig(value: UnknownRecord): boolean {
  const settings = value['settings'];
  const isOnUnhandledErrorValid = isNullableUnhandledErrorPolicy(value['onUnhandledError']);
  switch (value['mode']) {
    case 'merge': {
      return isRecordWithKnownKeys(value, JOIN_MERGE_NODE_CONFIG_KEYS) && isOnUnhandledErrorValid;
    }
    case 'script': {
      return (
        isRecordWithKnownKeys(value, JOIN_SCRIPT_NODE_CONFIG_KEYS) &&
        isScriptConfig(settings, EXPRESSION_SCRIPT_CONFIG_KEYS, JAVASCRIPT_SCRIPT_CONFIG_KEYS) &&
        isOnUnhandledErrorValid
      );
    }
    case 'ai_synthesis': {
      return (
        isRecordWithKnownKeys(value, JOIN_AI_SYNTHESIS_NODE_CONFIG_KEYS) &&
        isAgentStepConfig(settings) &&
        isOnUnhandledErrorValid
      );
    }
    // eslint-disable-next-line unicorn/no-null -- a választatlan join tárolt JSON-jában a `mode` ténylegesen `null` (SPEC-008 O-33).
    case null: {
      return isRecordWithKnownKeys(value, JOIN_UNSELECTED_NODE_CONFIG_KEYS) && isOnUnhandledErrorValid;
    }
    default: {
      return false;
    }
  }
}

function isLoopConfig(value: UnknownRecord): boolean {
  return (
    isRecordWithKnownKeys(value, LOOP_NODE_CONFIG_KEYS) &&
    isPositiveInteger(value.maxIterations) &&
    isString(value.continueExpression) &&
    isNullableUnhandledErrorPolicy(value.onUnhandledError)
  );
}

/**
 * A `timeoutMs` `null` esetén korlátlan várakozást jelent (SPEC-004 5.8).
 */
function isHumanApprovalConfig(value: UnknownRecord): boolean {
  const timeoutMs = value['timeoutMs'];
  return (
    isRecordWithKnownKeys(value, HUMAN_APPROVAL_NODE_CONFIG_KEYS) &&
    isString(value.title) &&
    isString(value.bodyTemplate) &&
    (timeoutMs === null || isNumber(timeoutMs)) &&
    isNullableUnhandledErrorPolicy(value.onUnhandledError)
  );
}

function isErrorHandlerConfig(value: UnknownRecord): boolean {
  const backoffMs = value['backoffMs'];
  return (
    isRecordWithKnownKeys(value, ERROR_HANDLER_NODE_CONFIG_KEYS) &&
    isPositiveInteger(value.maxAttempts) &&
    Array.isArray(backoffMs) &&
    backoffMs.every((delay: unknown) => isPositiveInteger(delay)) &&
    isStringArray(value.handledErrorKinds) &&
    isNullableUnhandledErrorPolicy(value.onUnhandledError)
  );
}

function isSubWorkflowConfig(value: UnknownRecord): boolean {
  return (
    isRecordWithKnownKeys(value, SUB_WORKFLOW_NODE_CONFIG_KEYS) &&
    isString(value.targetWorkflowId) &&
    isStringRecord(value.inputMapping) &&
    isNullableUnhandledErrorPolicy(value.onUnhandledError)
  );
}

/**
 * Typeguard a node config unióra (SPEC-003 4.3 és 9.4 szekció). A `switch`
 * mind a tíz `NodeType` ágat lefedi, és a fordító `switch-exhaustiveness-check`
 * szabálya hibát ad, ha az unió bővül: egy tizenegyedik típus nem tud csendben
 * átcsúszni. Ismeretlen `type` értékre a guard már az `isNodeType` lépésnél
 * hamisat ad.
 */
export function isNodeConfig(value: unknown): value is NodeConfig {
  if (!isRecord(value)) {
    return false;
  }
  const type = value['type'];
  if (!isNodeType(type)) {
    return false;
  }
  switch (type) {
    case 'start': {
      return isStartConfig(value);
    }
    case 'agent_step': {
      // Az `isAgentStepConfig` a megosztott `AgentStepConfig` alakot
      // ellenőrzi, amit a `join` `ai_synthesis` módja is használ; az az alak
      // nem tartalmazza az `onUnhandledError` mezőt, ezért itt, a hívási
      // helyen kell hozzáadni a feltételt (node-config.ts elhelyezési szabály).
      // A burkoló két kulcsa nélkül az `isAgentStepConfig` zárt kulcslistája
      // dönt minden más kulcsról.
      return (
        isAgentStepConfig(withoutAgentStepNodeEnvelope(value)) &&
        isNullableUnhandledErrorPolicy(value['onUnhandledError'])
      );
    }
    case 'branch': {
      return isBranchConfig(value);
    }
    case 'fan_out': {
      return isFanOutConfig(value);
    }
    case 'join': {
      return isJoinConfig(value);
    }
    case 'loop': {
      return isLoopConfig(value);
    }
    case 'human_approval': {
      return isHumanApprovalConfig(value);
    }
    case 'error_handler': {
      return isErrorHandlerConfig(value);
    }
    case 'sub_workflow': {
      return isSubWorkflowConfig(value);
    }
    case 'script': {
      // Az `isScriptConfig` a megosztott `ScriptConfig` alakot ellenőrzi,
      // amit a `join` `script` módja is használ (annak `settings` alobjektuma
      // marad `ScriptConfig`, `onUnhandledError` nélkül); a hívási helyen kell
      // hozzáadni a feltételt, ugyanúgy, mint az `agent_step` ágnál.
      return (
        isScriptConfig(value, EXPRESSION_SCRIPT_NODE_CONFIG_KEYS, JAVASCRIPT_SCRIPT_NODE_CONFIG_KEYS) &&
        isNullableUnhandledErrorPolicy(value['onUnhandledError'])
      );
    }
  }
}
