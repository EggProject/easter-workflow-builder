/**
 * Az `approval_requested` esemény payloadja (SPEC-004 13. szekció táblázat,
 * `approval_requested` sor): jóváhagyás kérésekor íródik. A `timeoutAtMs`
 * `null`, ha a `human_approval` lépés `timeoutMs` mezője korlátlan
 * várakozást jelent (24. kritérium).
 */
export interface ApprovalRequestedPayload {
  readonly approvalId: string;
  readonly requestedAtMs: number;
  readonly timeoutAtMs: number | null;
}
