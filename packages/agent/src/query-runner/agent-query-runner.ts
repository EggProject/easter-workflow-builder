import type { Outcome } from '@easter-workflow-builder/core';
import type { AgentQuery } from './agent-query.ts';
import type { AgentQueryRequest } from './agent-query-request.ts';

/**
 * A motorba befecskendezett futtató port (SPEC-004 3.2, 3.3). A típus itt él,
 * az `agent` csomagban, nem a motorban: az `agent` (L4) nem importálhat a
 * motorból (L5), mert az kört adna, viszont az L5 felől az L4 él megengedett.
 *
 * A `run` **szinkron** `Outcome` értéket ad, nem `Promise<Outcome<...>>`: az
 * SDK `query()` függvénye sem async, azonnal ad egy kezelőt, amit utána
 * aszinkron iterálunk. Az `Outcome` burkoló mégis kell, mert a port határán
 * kivétel nem repülhet ki a hívó felé (`Outcome` doc, `packages/core`).
 */
export interface AgentQueryRunner {
  run(request: AgentQueryRequest): Outcome<AgentQuery>;
}
