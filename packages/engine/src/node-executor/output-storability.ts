import { MAX_STORED_OUTPUT_LENGTH } from './max-stored-output-length.ts';

/**
 * A lépés kimenetének tárolhatósága, a tárolás ELŐTT eldöntve (SPEC-010 O-15,
 * O-18, O-21): `storable`, ha a `JSON.stringify` eredménye nem hosszabb a
 * `MAX_STORED_OUTPUT_LENGTH` korlátnál; `too_large`, ha hosszabb;
 * `not_serializable`, ha a szerializálás kivételt dob (például egy `toJSON`
 * hiba, körkörös hivatkozás, vagy a V8 szöveg korlátja fölötti `RangeError`).
 * A két hibaág külön mondatot kap, mert a kivétel oka nem mindig a méret
 * (PLAN-010 T-010-21 A-8, user döntés 2026-10-25). A `db` a `step_run.output`
 * oszlopot a záró tranzakción belül szerializálja és olvassa vissza; ez az
 * ellenőrzés azért fut előtte, hogy a végrehajtó a hibát lépés szintű
 * hibaosztállyal zárhassa (research `2026-10-21-spec010-blokkolo-meresek.md`
 * 10.2 és 12. szekció). Az `undefined` kimenetet a `db` nem írja
 * (`markStepSucceeded` `output` mezője opcionális), tehát az tárolható; a
 * `JSON.stringify` rá szöveg helyett `undefined`-et ad.
 */
export function outputStorabilityOf(value: unknown): 'storable' | 'too_large' | 'not_serializable' {
  if (value === undefined) {
    return 'storable';
  }
  try {
    return JSON.stringify(value).length <= MAX_STORED_OUTPUT_LENGTH ? 'storable' : 'too_large';
  } catch {
    return 'not_serializable';
  }
}
