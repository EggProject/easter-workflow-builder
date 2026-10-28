import { describe, expect, expectTypeOf, it } from 'vitest';
import { formatEngineErrorMessage, isEngineErrorKind, type EngineErrorKind } from '@easter-workflow-builder/engine';
import { ProtocolErrorClassSchema, type ProtocolErrorClass } from '@easter-workflow-builder/protocol';
import { buildProtocolErrorBody } from '../error-mapping/build-protocol-error-body.ts';
import { SKILL_UPLOAD_ERROR_CLASSES, type SkillUploadErrorClass } from '../skill-endpoint/skill-upload-error-class.ts';

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
 *
 * **A skill feltöltés tizenöt osztálya (SPEC-009 5.4, O-41)** szintén szerver
 * oldali, nem motor osztály: a `skill-endpoint` téma egyetlen `as const`
 * táblában (`SKILL_UPLOAD_ERROR_CLASSES`) deklarálja, és a típusszintű ág erre
 * a táblára hivatkozik, így a szótár és a tábla mindkét irányban egyezik.
 */
describe('a protokoll hibaosztály szótára a motor hibaosztályainak részhalmaza', () => {
  it('típusszinten: az already_decided és a skill feltöltés osztályai kivételével minden érték EngineErrorKind', () => {
    // Ha a motor átnevez vagy elvesz egy itt álló hibaosztályt, vagy a skill
    // tábla és a szótár eltér, a különbség változik, és a `bun run typecheck`
    // kapu fordítási hibával bukik.
    expectTypeOf<Exclude<ProtocolErrorClass, EngineErrorKind>>().toEqualTypeOf<
      'already_decided' | SkillUploadErrorClass
    >();
  });

  it('futásidőben: az already_decided és a skill feltöltés osztályai kivételével minden érték átmegy a motor isEngineErrorKind guardján', () => {
    expect(ProtocolErrorClassSchema.options.filter((value) => !isEngineErrorKind(value))).toStrictEqual([
      'already_decided',
      ...SKILL_UPLOAD_ERROR_CLASSES,
    ]);
  });

  it.each(SKILL_UPLOAD_ERROR_CLASSES)(
    'a skill feltöltés %s osztályát hordozó üzenetből a szerver errorClass mezőt és unprocessable kódot ad',
    (errorClass) => {
      const body = buildProtocolErrorBody(`A skill feltöltése elutasítva (${errorClass}).`);

      expect(body.errorClass).toBe(errorClass);
      expect(body.code).toBe('unprocessable');
    },
  );

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
