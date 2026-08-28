import type { ModelsEndpointCapability } from '@easter-workflow-builder/provider-capability';
import { isKnownFact } from '@easter-workflow-builder/provider-capability';
import type { ConnectionTestMode } from './connection-test-mode.ts';

/**
 * A kapcsolat teszt alakja (SPEC-004 11.3 táblázat 16. sora, leíró mezők:
 * `modelsEndpoint.calledBySdk`, `modelsEndpoint.directHttpReachable`):
 *
 * - `calledBySdk` `known` igaz: az SDK maga hívja a modell végpontot, tehát a
 *   teszt onnan ad listát (`sdk_model_list`).
 * - `calledBySdk` `known` hamis: a teszt egy minimális `query()` hívás.
 * - `calledBySdk` `unknown`: ugyanaz a minimális `query()` hívás, mert
 *   bizonyíték nélkül a motor nem feltételezi, hogy a listás út járható.
 *
 * **A `directHttpReachable` mező szándékosan nem befolyásolja a döntést**, és
 * ez nem a mező elhagyása, hanem következmény: a motor egyetlen hálózati
 * kapcsolatot sem nyit (SPEC-004 17. szekció 7. kritérium), tehát egy közvetlen,
 * SDK-n kívüli HTTP út járhatósága a motor számára nem választható menet. A
 * mező a kapcsolat teszt diagnosztikájának marad. A paraméter ezért a teljes
 * `ModelsEndpointCapability`, hogy a leíró mezőcsoportja a szignatúrában is
 * látszódjon.
 */
export function resolveConnectionTestMode(modelsEndpoint: ModelsEndpointCapability): ConnectionTestMode {
  return isKnownFact(modelsEndpoint.calledBySdk) && modelsEndpoint.calledBySdk.value
    ? 'sdk_model_list'
    : 'minimal_query';
}
