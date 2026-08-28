import type { NodeType } from '@easter-workflow-builder/db';
import type { ProviderId } from '@easter-workflow-builder/provider-capability';

/**
 * A `step_started` esemény payloadja (SPEC-004 13. szekció táblázat,
 * `step_started` sor): a lépés `running` állapotba lépésekor íródik. Az öt
 * kötelező mező áll itt.
 *
 * **Szándékosan hiányoznak a SPEC-004 11.3 táblázat jelölő mezői** (pl.
 * `strategyUnproven`, a wire modellazonosító jelzése, a `thinking`/`effort`
 * elhagyásának jelzése, a letiltott szerver oldali tool neve): ezeket a
 * `capability-policy` téma (PLAN-005 T-005-13, egy KÉSŐBBI lépés) határozza
 * meg pontosan, mert a leírótól függő tizenhat viselkedés alakja csak ott
 * dől el. Ez az interfész emiatt egy KÉSŐBBI lépésben bővül, opcionális
 * mezőkkel, nem cserélődik le.
 */
export interface StepStartedPayload {
  readonly nodeId: string;
  readonly nodeType: NodeType;
  readonly providerId: ProviderId;
  readonly attempt: number;
  readonly iteration: number;
}
