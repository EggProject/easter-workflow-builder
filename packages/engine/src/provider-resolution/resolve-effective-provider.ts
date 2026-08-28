import type { Outcome } from '@easter-workflow-builder/core';
import type { ProviderId } from '@easter-workflow-builder/provider-capability';
import { formatEngineErrorMessage } from '../engine-error/format-engine-error-message.ts';

/**
 * A háromszintű provider feloldás (SPEC-004 11.1): a lépés felülírása erősebb
 * a workflow felülírásnál, ami erősebb a globális alapértelmezésnél. Ha egyik
 * szint sem ad értéket, a futás indítása `no_default_provider` hibával áll
 * meg (SPEC-003 4.13).
 *
 * Tiszta függvény, adatbázis nélkül tesztelhető: mindhárom bemenet a hívó
 * felelőssége (`app_setting.default_provider_id`, `workflow.provider_id`,
 * az agent lépés configjának `providerId` mezője), a feloldás csak az
 * elsőbbségi sorrendet dönti el.
 */
export function resolveEffectiveProvider(
  globalDefault: ProviderId | null,
  workflowOverride: ProviderId | null,
  stepOverride: ProviderId | null,
): Outcome<ProviderId> {
  if (stepOverride !== null) {
    return { kind: 'ok', value: stepOverride };
  }
  if (workflowOverride !== null) {
    return { kind: 'ok', value: workflowOverride };
  }
  if (globalDefault !== null) {
    return { kind: 'ok', value: globalDefault };
  }
  return {
    kind: 'error',
    message: formatEngineErrorMessage('no_default_provider', 'Nincs feloldható provider egyik szinten sem'),
  };
}
