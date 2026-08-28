import type { ApprovalDecision } from '@easter-workflow-builder/db';

/**
 * Az `approval_decided` esemény payloadja (SPEC-004 13. szekció táblázat,
 * `approval_decided` sor): döntés érkezésekor vagy az időkorlát lejártakor
 * íródik.
 */
export interface ApprovalDecidedPayload {
  readonly decision: ApprovalDecision;
  readonly decidedAtMs: number;
  readonly waitedMs: number;
}
