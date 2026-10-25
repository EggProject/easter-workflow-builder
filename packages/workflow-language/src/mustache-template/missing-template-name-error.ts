/**
 * A sima változó tag (`{{név}}`, `{{{név}}}`, `{{& név}}`) fel nem oldható neve
 * (SPEC-010 6.7, O-4). Az üzenet a teljes, kért nevet idézi, mert a felhasználó
 * azt írta a sablonba; idézőjelben áll, mert egy ponttal záruló név (`{{a.}}`)
 * nélküle ponttal zárná a mondatot (a szerkesztő maga tesz pontot a végére). A kivétel csak a renderelés közben, a csomagon belül
 * repül: a gyártó függvény `Outcome` hibaágba teszi.
 */
export class MissingTemplateNameError extends Error {
  constructor(missingName: string) {
    super(`hiányzó név a sablonban: "${missingName}"`);
  }
}
