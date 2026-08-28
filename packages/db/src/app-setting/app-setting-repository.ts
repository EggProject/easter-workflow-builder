import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { isProviderId, type ProviderId } from '@easter-workflow-builder/provider-capability';
import type { Outcome } from '@easter-workflow-builder/core';
import { APP_SETTING_ROW_ID, appSettingTable } from './app-setting.ts';

/**
 * Ugyanaz az aláírás, mint a `DatabaseContext.transaction` (SPEC-003 9.1
 * szekció). Nem onnan importáljuk, hogy elkerüljük a kört, ugyanaz a minta,
 * mint a `workflow-run-repository.ts`-ben.
 */
type TransactionFunction = <TValue>(work: () => Outcome<TValue>) => Outcome<TValue>;

export interface AppSettingsRecord {
  readonly defaultProviderId: ProviderId | null;
  readonly persistStreamDeltas: boolean;
}

export interface AppSettingRepository {
  readSettings(): Outcome<AppSettingsRecord>;
  setDefaultProvider(providerId: ProviderId): Outcome<void>;
  setPersistStreamDeltas(isEnabled: boolean): Outcome<void>;
}

/**
 * `packages/db/CLAUDE.md` "Outcome hibaosztály konvenció" szerint: a
 * hibaosztály neve szó szerint, zárójelben áll az emberi nyelvű üzenetben.
 */
export function createAppSettingRepository(
  database: BetterSQLite3Database,
  transaction: TransactionFunction,
): AppSettingRepository {
  /**
   * A `readSettings` üres táblán ugyanazt az alapértelmezést adja, mint a
   * séma szintű `DEFAULT` (SPEC-003 4.13 szekció, "A sor életciklusa", 56.
   * kritérium): `defaultProviderId: null`, `persistStreamDeltas: false`. A
   * `default_provider_id` oszlopon nincs DB szintű `CHECK`, ezért egy
   * meglévő sor korrupt értékét az `isProviderId` guard szűri (SPEC-003 9.4
   * szekció), ugyanaz a minta, mint a `WorkflowRepository.toWorkflowRecord`.
   */
  function readSettings(): Outcome<AppSettingsRecord> {
    return transaction(() => {
      const row = database.select().from(appSettingTable).where(eq(appSettingTable.id, APP_SETTING_ROW_ID)).get();
      if (row === undefined) {
        // eslint-disable-next-line unicorn/no-null -- a séma szintű DEFAULT-tal egyező alapértelmezés, nincs még sor
        return { kind: 'ok', value: { defaultProviderId: null, persistStreamDeltas: false } };
      }
      const defaultProviderId = row.defaultProviderId;
      if (defaultProviderId !== null && !isProviderId(defaultProviderId)) {
        return {
          kind: 'error',
          message: `Az app_setting default_provider_id mezője érvénytelen: "${defaultProviderId}" (invalid_provider_id).`,
        };
      }
      return { kind: 'ok', value: { defaultProviderId, persistStreamDeltas: row.persistStreamDeltas } };
    });
  }

  /**
   * Upsert `INSERT ... ON CONFLICT(id) DO UPDATE` alakban (SPEC-003 4.13
   * szekció, "A sor életciklusa"). Ha ez a hívás hozza létre a sort először,
   * a `persistStreamDeltas` mezőt szándékosan **nem** adjuk meg a
   * `.values()`-ban, tehát a séma szintű `.default(false)` tölti ki (F-28),
   * nem egy itt kitalált érték.
   */
  function setDefaultProvider(providerId: ProviderId): Outcome<void> {
    return transaction(() => {
      const now = new Date();
      database
        .insert(appSettingTable)
        .values({ id: APP_SETTING_ROW_ID, defaultProviderId: providerId, updatedAtMs: now })
        .onConflictDoUpdate({
          target: appSettingTable.id,
          set: { defaultProviderId: providerId, updatedAtMs: now },
        })
        .run();
      return { kind: 'ok', value: undefined };
    });
  }

  /**
   * Ugyanaz az upsert minta, mint a `setDefaultProvider`-ben, fordítva: ha
   * ez a hívás hozza létre a sort először, a `defaultProviderId` mezőt nem
   * adjuk meg, tehát NULL marad (a `default_provider_id` oszlopnak nincs
   * séma szintű alapértéke, SPEC-003 4.13 szekció).
   */
  function setPersistStreamDeltas(isEnabled: boolean): Outcome<void> {
    return transaction(() => {
      const now = new Date();
      database
        .insert(appSettingTable)
        .values({ id: APP_SETTING_ROW_ID, persistStreamDeltas: isEnabled, updatedAtMs: now })
        .onConflictDoUpdate({
          target: appSettingTable.id,
          set: { persistStreamDeltas: isEnabled, updatedAtMs: now },
        })
        .run();
      return { kind: 'ok', value: undefined };
    });
  }

  return { readSettings, setDefaultProvider, setPersistStreamDeltas };
}
