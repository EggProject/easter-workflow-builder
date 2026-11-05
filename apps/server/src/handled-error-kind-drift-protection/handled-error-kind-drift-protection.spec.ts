import { describe, expect, expectTypeOf, it } from 'vitest';
import { isNodeConfig, type HandledErrorKind as DatabaseHandledErrorKind } from '@easter-workflow-builder/db';
import { isEngineErrorKind, type EngineErrorKind } from '@easter-workflow-builder/engine';
import {
  HandledErrorKindSchema,
  NodeConfigSaveSchema,
  NodeConfigSchema,
  type HandledErrorKind as ProtocolHandledErrorKind,
} from '@easter-workflow-builder/protocol';

// Egy érvényes `error_handler` config a megadott kezelt hibafajtákkal.
function errorHandlerConfig(handledErrorKinds: readonly string[]): Readonly<Record<string, unknown>> {
  return { type: 'error_handler', maxAttempts: 2, backoffMs: [100], handledErrorKinds, onUnhandledError: 'fail_run' };
}

/**
 * Az `error_handler` kezelt hibafajtáinak sodródás elleni védelme (SPEC-004 8.2,
 * O-5, user döntés 2026-11-04, "Zárt lista"). Három oldal áll egymás mellett: a
 * `db` `HandledErrorKind` uniója (a tárolt config típusa), a `protocol`
 * `HandledErrorKindSchema` duplikátuma (a szerkesztő és a drót típusa) és a motor
 * `EngineErrorKind` uniója, aminek a lista a részhalmaza. A `protocol` L1, a `db`
 * L2, a motor L5 réteg; az `apps/server` az egyetlen csomag, ahol mind a három
 * látszik (ugyanaz az elv, mint az `enum-drift-protection` és az
 * `error-class-drift-protection` témában).
 *
 * **Ennek a mappának szándékosan nincs futásidejű forrásfájlja**
 * (`.claude/CLAUDE.md` 5. szekció, megvalósítás nélküli regressziós teszt).
 *
 * A típusszintű ágakat a `bun run typecheck` kapu dönti el; a futásidejű ágak a
 * `db` guardját (az `isNodeConfig` guardon át, mert a `db` barrel a felsorolás
 * guardját nem exportálja) és a motor `isEngineErrorKind` guardját futtatják a
 * `protocol` minden felsorolt értékén.
 */
describe('a kezelt hibafajták zárt listája a db, a protocol és a motor között', () => {
  it('típusszinten: a protocol és a db uniója kétirányban megegyezik', () => {
    expectTypeOf<ProtocolHandledErrorKind>().toEqualTypeOf<DatabaseHandledErrorKind>();
  });

  it('típusszinten: a lista minden tagja motor hibaosztály', () => {
    expectTypeOf<Exclude<DatabaseHandledErrorKind, EngineErrorKind>>().toEqualTypeOf<never>();
  });

  it('futásidőben: a protocol minden értéke átmegy a motor isEngineErrorKind guardján', () => {
    expect(HandledErrorKindSchema.options.filter((kind) => !isEngineErrorKind(kind))).toStrictEqual([]);
  });

  it.each(HandledErrorKindSchema.options)(
    'a(z) %s értéket a db guard és a protocol mindkét sémája elfogadja',
    (kind) => {
      const config = errorHandlerConfig([kind]);

      expect(isNodeConfig(config)).toBe(true);
      expect(NodeConfigSchema.safeParse(config).success).toBe(true);
      expect(NodeConfigSaveSchema.safeParse(config).success).toBe(true);
    },
  );

  // A futás indításának validációs osztálya, a két másik menekülő él osztálya, a
  // régi szabad szöveges érték és az üres szöveg: egyik sem kezelhető.
  it.each(['graph_cycle_detected', 'approval_rejected', 'retry_attempts_exhausted', 'timeout', ''])(
    'a listán kívüli %j értéket mindkét oldal elutasítja',
    (kind) => {
      const config = errorHandlerConfig([kind]);

      expect(isNodeConfig(config)).toBe(false);
      expect(NodeConfigSchema.safeParse(config).success).toBe(false);
      expect(NodeConfigSaveSchema.safeParse(config).success).toBe(false);
    },
  );
});
