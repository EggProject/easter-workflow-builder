import type { ScriptRunResult } from '@easter-workflow-builder/engine';
import { isRecordWithKnownKeys, isString } from '@easter-workflow-builder/typeguards';

const SCRIPT_FAILURE_KINDS: ReadonlySet<unknown> = new Set([
  'script_evaluation_failed',
  'script_timed_out',
  'script_output_not_json',
]);

/**
 * A szkript folyamat IPC válaszának alakja (SPEC-017 4.2): `succeeded` a JSON
 * kimenettel, vagy `failed` a három futásidejű hibaosztály egyikével és
 * üzenettel. Az `aborted` ág nem jöhet a folyamatból, mert a külső leállítás
 * a folyamat megölése (SPEC-017 4.4).
 */
export function isScriptRunResult(value: unknown): value is ScriptRunResult {
  if (isRecordWithKnownKeys(value, { kind: true, output: true }) && value.kind === 'succeeded') {
    return Object.hasOwn(value, 'output');
  }
  return (
    isRecordWithKnownKeys(value, { kind: true, errorKind: true, message: true }) &&
    value.kind === 'failed' &&
    SCRIPT_FAILURE_KINDS.has(value.errorKind) &&
    isString(value.message)
  );
}
