/* eslint-disable unicorn/no-null -- a SettingsRecord defaultProviderId mezője beállítás nélkül a dróton ténylegesen `null` értéket hordoz, nem helyőrző `undefined`-et */
import { describe, expect, it } from 'vitest';
import { SettingsRecordSchema, UpdateSettingsRequestSchema } from './settings-record.ts';

describe('SettingsRecordSchema', () => {
  it('elfogadja a kitöltött beállítást', () => {
    expect(SettingsRecordSchema.safeParse({ defaultProviderId: 'minimax', persistStreamDeltas: false }).success).toBe(
      true,
    );
  });

  it('elfogadja a beállítatlan default providert (null)', () => {
    expect(SettingsRecordSchema.safeParse({ defaultProviderId: null, persistStreamDeltas: true }).success).toBe(true);
  });

  it('elutasítja, ha a persistStreamDeltas mező hiányzik', () => {
    expect(SettingsRecordSchema.safeParse({ defaultProviderId: null }).success).toBe(false);
  });
});

describe('UpdateSettingsRequestSchema', () => {
  it('elfogadja az üres törzset (mindkét mező elhagyható)', () => {
    expect(UpdateSettingsRequestSchema.safeParse({}).success).toBe(true);
  });

  it('elfogadja a részleges frissítést, csak egy mezővel', () => {
    expect(UpdateSettingsRequestSchema.safeParse({ persistStreamDeltas: true }).success).toBe(true);
  });

  it('elutasítja az ismeretlen kulcsot', () => {
    expect(UpdateSettingsRequestSchema.safeParse({ extra: 1 }).success).toBe(false);
  });
});
