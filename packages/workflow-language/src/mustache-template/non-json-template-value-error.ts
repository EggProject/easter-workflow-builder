/**
 * A sima változó tag (`{{név}}`, `{{{név}}}`, `{{& név}}`) neve feloldható, de
 * nem JSON értékre mutat (`Map`, `Date`, osztálypéldány, `BigInt`, `Symbol`),
 * ezért nem írható ki (SPEC-010 6.5, user döntés 2026-10-25). Az üzenet a
 * hiányzó név hibájához hasonlóan a teljes, kért nevet idézi, a sablon többi
 * szövegét nem. A kivétel csak a renderelés közben, a csomagon belül repül: a
 * gyártó függvény `Outcome` hibaágba teszi.
 */
export class NonJsonTemplateValueError extends Error {
  constructor(name: string) {
    super(`nem JSON értékre mutató név a sablonban: ${name}`);
  }
}
