import { isNumber, isRecordWithKnownKeys, isString } from '@easter-workflow-builder/typeguards';
import type { SandboxRunRequest } from './sandbox-run-request.ts';

const SANDBOX_RUN_REQUEST_KEYS: Readonly<Record<keyof SandboxRunRequest, true>> = {
  source: true,
  contextJson: true,
  root: true,
  timeoutMs: true,
  deadlineMs: true,
  memoryLimitMb: true,
  fetchResponseLimitMb: true,
  fileReadLimitMb: true,
};

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || isNumber(value);
}

/**
 * Az IPC csatornán érkezett kérés alakja (SPEC-017 4.2): a szkript folyamat
 * csak ilyen kérést futtat, minden más üzenetre hibát ad
 * (`serve-script-child.ts`). Zárt kulcslista, a projekt mintája szerint.
 */
export function isSandboxRunRequest(value: unknown): value is SandboxRunRequest {
  return (
    isRecordWithKnownKeys(value, SANDBOX_RUN_REQUEST_KEYS) &&
    isString(value.source) &&
    isString(value.contextJson) &&
    isString(value.root) &&
    isNumber(value.timeoutMs) &&
    isNumber(value.deadlineMs) &&
    isNumberOrNull(value.memoryLimitMb) &&
    isNumberOrNull(value.fetchResponseLimitMb) &&
    isNumberOrNull(value.fileReadLimitMb)
  );
}
