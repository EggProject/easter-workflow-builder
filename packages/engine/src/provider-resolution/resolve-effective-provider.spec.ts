/* eslint-disable unicorn/no-null -- a `resolveEffectiveProvider` mindhárom paramétere `ProviderId | null`, mert a `null` a `app_setting.default_provider_id`, a `workflow.provider_id` és a lépés config `providerId` mezőjének tárolt SQL NULL értékét jelenti (SPEC-004 11.1), nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import type { ProviderId } from '@easter-workflow-builder/provider-capability';
import { resolveEffectiveProvider } from './resolve-effective-provider.ts';

// A tesztekhez a `ProviderId` unió két tényleges értéke kell, mert a típus
// csak ezt a kettőt engedi (SPEC-004 12. szekció, PLAN-005 T-005-12
// elfogadási kritérium: a tilalom a nem-teszt forráskódra vonatkozik).
const providerA: ProviderId = 'claude-subscription';
const providerB: ProviderId = 'minimax';

describe('resolveEffectiveProvider', () => {
  it('csak a lépés felülírása van megadva: azt adja vissza', () => {
    expect(resolveEffectiveProvider(null, null, providerA)).toStrictEqual({ kind: 'ok', value: providerA });
  });

  it('csak a workflow felülírása van megadva: azt adja vissza', () => {
    expect(resolveEffectiveProvider(null, providerA, null)).toStrictEqual({ kind: 'ok', value: providerA });
  });

  it('csak a globális alapértelmezés van megadva: azt adja vissza', () => {
    expect(resolveEffectiveProvider(providerA, null, null)).toStrictEqual({ kind: 'ok', value: providerA });
  });

  it('felülírási sorrend: mindhárom szint kitöltött, a lépés felülírása nyer', () => {
    expect(resolveEffectiveProvider(providerA, providerB, providerA)).toStrictEqual({
      kind: 'ok',
      value: providerA,
    });
  });

  it('felülírási sorrend: lépés felülírás nélkül a workflow felülírása nyer a globális alapértelmezés felett', () => {
    expect(resolveEffectiveProvider(providerA, providerB, null)).toStrictEqual({ kind: 'ok', value: providerB });
  });

  it('egyik szinten sincs érték: no_default_provider hibát ad', () => {
    expect(resolveEffectiveProvider(null, null, null)).toStrictEqual({
      kind: 'error',
      message: 'Nincs feloldható provider egyik szinten sem (no_default_provider).',
    });
  });
});
