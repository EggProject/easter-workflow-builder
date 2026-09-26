import { describe, expect, expectTypeOf, it } from 'vitest';
import { formatEngineErrorMessage, isEngineErrorKind, type EngineErrorKind } from '@easter-workflow-builder/engine';
import { ProtocolErrorClassSchema, type ProtocolErrorClass } from '@easter-workflow-builder/protocol';
import { buildProtocolErrorBody } from '../error-mapping/build-protocol-error-body.ts';

/**
 * A protokoll `ProtocolErrorClass` szótárának sodródás elleni védelme
 * (SPEC-005 8.5). A `packages/protocol` L1 réteg, a motor `EngineErrorKind`
 * uniója L5: a protokoll a saját, szándékos részhalmazát önállóan deklarálja,
 * és az `apps/server` az egyetlen csomag, ahol a két oldal egyszerre
 * látszik (ugyanaz az elv, mint az `enum-drift-protection` és a
 * `node-config-drift-protection` témában).
 *
 * **Ennek a mappának szándékosan nincs futásidejű forrásfájlja**
 * (`.claude/CLAUDE.md` 5. szekció, megvalósítás nélküli regressziós teszt).
 *
 * **A reláció részhalmaz, nem egyenlőség**: a protokoll szótára a motor
 * hibaosztályai közül csak a futás indításának validációs osztályait
 * tartalmazza, plusz a `packages/db` `already_decided` ágát, aminek nincs
 * típusszintű uniója a `db` csomagban. Az utóbbi futásidejű védelme a valódi
 * adatbázison futó `approval-endpoint/decide-approval.spec.ts` "már
 * eldöntött" tesztje: az a `db` saját üzenetéből ellenőrzi, hogy a törzs
 * `errorClass` mezője `already_decided`.
 */
describe('a protokoll hibaosztály szótára a motor hibaosztályainak részhalmaza', () => {
  it('típusszinten: az already_decided kivételével minden érték EngineErrorKind', () => {
    // Ha a motor átnevez vagy elvesz egy itt álló hibaosztályt, a különbség
    // bővül, és a `bun run typecheck` kapu fordítási hibával bukik.
    expectTypeOf<Exclude<ProtocolErrorClass, EngineErrorKind>>().toEqualTypeOf<'already_decided'>();
  });

  it('futásidőben: az already_decided kivételével minden érték átmegy a motor isEngineErrorKind guardján', () => {
    expect(ProtocolErrorClassSchema.options.filter((value) => !isEngineErrorKind(value))).toStrictEqual([
      'already_decided',
    ]);
  });

  const engineClasses: readonly EngineErrorKind[] = ProtocolErrorClassSchema.options.filter((value) =>
    isEngineErrorKind(value),
  );

  it.each(engineClasses)(
    'a motor saját formázójával előállított %s üzenetből a szerver errorClass mezőt és unprocessable kódot ad',
    (errorClass) => {
      const body = buildProtocolErrorBody(formatEngineErrorMessage(errorClass, 'A futás nem indítható'));

      expect(body.errorClass).toBe(errorClass);
      expect(body.code).toBe('unprocessable');
    },
  );
});
