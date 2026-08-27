import { isBoolean, isInt, isRecord, isString } from '@easter-workflow-builder/typeguards';
import type { BranchOption, NodeConfig, StartInputField } from './node-config.ts';
import type { ScriptConfig } from './script-config.ts';
import { isAgentStepConfig } from './is-agent-step-config.ts';
import { isNodeType } from './is-node-type.ts';
import { isStringArray } from './is-string-array.ts';

type UnknownRecord = Readonly<Record<string, unknown>>;

/**
 * Iterációszám és retry darabszám: a SPEC-003 4.3 szerint az egyetlen séma
 * szintű megkötés, ami definíció szerint igaz, hogy az érték egész és pozitív.
 * Alapértéket a spec kifejezetten nem szállít, ezért a guard sem pótol.
 */
function isPositiveInteger(value: unknown): value is number {
  return isInt(value) && value > 0;
}

function isStringRecord(value: unknown): value is Readonly<Record<string, string>> {
  return isRecord(value) && Object.values(value).every((entry: unknown) => isString(entry));
}

function isScriptConfig(value: unknown): value is ScriptConfig {
  return isRecord(value) && isString(value['source']) && value['runtime'] === 'expression';
}

function isStartInputField(value: unknown): value is StartInputField {
  return (
    isRecord(value) &&
    isString(value['name']) &&
    isString(value['label']) &&
    isString(value['valueKind']) &&
    isBoolean(value['required'])
  );
}

function isStartConfig(value: UnknownRecord): boolean {
  const inputFields = value['inputFields'];
  return Array.isArray(inputFields) && inputFields.every((field: unknown) => isStartInputField(field));
}

function isBranchOption(value: unknown): value is BranchOption {
  return isRecord(value) && isString(value['key']) && isString(value['label']);
}

function isBranchConfig(value: UnknownRecord): boolean {
  const branches = value['branches'];
  const defaultBranchKey = value['defaultBranchKey'];
  return (
    isString(value['expression']) &&
    Array.isArray(branches) &&
    branches.every((option: unknown) => isBranchOption(option)) &&
    (defaultBranchKey === null || isString(defaultBranchKey))
  );
}

function isFanOutConfig(value: UnknownRecord): boolean {
  return isString(value['itemsExpression']) && isString(value['branchLabelTemplate']);
}

/**
 * A `join` három módja. Az `ai_synthesis` alobjektuma pontosan az
 * `AgentStepConfig`, a `script` módé ugyanaz a `ScriptConfig`, mint a `script`
 * node-é, a `merge` módé pedig nyitott alakú rekord (lásd `node-config.ts`).
 */
function isJoinConfig(value: UnknownRecord): boolean {
  const settings = value['settings'];
  switch (value['mode']) {
    case 'merge': {
      return isRecord(settings);
    }
    case 'script': {
      return isScriptConfig(settings);
    }
    case 'ai_synthesis': {
      return isAgentStepConfig(settings);
    }
    default: {
      return false;
    }
  }
}

function isLoopConfig(value: UnknownRecord): boolean {
  return isPositiveInteger(value['maxIterations']) && isString(value['continueExpression']);
}

function isHumanApprovalConfig(value: UnknownRecord): boolean {
  return isString(value['title']) && isString(value['bodyTemplate']);
}

function isErrorHandlerConfig(value: UnknownRecord): boolean {
  const backoffMs = value['backoffMs'];
  return (
    isPositiveInteger(value['maxAttempts']) &&
    Array.isArray(backoffMs) &&
    backoffMs.every((delay: unknown) => isPositiveInteger(delay)) &&
    isStringArray(value['handledErrorKinds'])
  );
}

function isSubWorkflowConfig(value: UnknownRecord): boolean {
  return isString(value['targetWorkflowId']) && isStringRecord(value['inputMapping']);
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
      return isAgentStepConfig(value);
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
      return isScriptConfig(value);
    }
  }
}
