/**
 * Saját-e a tárolt arány (user döntés 2026-09-25, "a rajz húzódjon össze"):
 * igaz, ha a tárolt pár eltér az alapértelmezéstől. Ettől függ, hogy egy
 * függő jóváhagyás kedvéért az elválasztó ideiglenesen elmozdulhat-e
 * (`Resizable` `adjustsForReveal`, SPEC-008 8. szekció 1. pont).
 *
 * MIÉRT NEM ELÉG A KULCS MEGLÉTE. A `Resizable` 2026-09-25-ig minden
 * csatoláskor a kezdőértéket is a tárolóba írta (`onSizesChange` a kezdő
 * renderen), tehát a két kulcs (`eggRunViewLayout`,
 * `eggRunViewTranscriptApprovalLayout`) a futás nézet első megnyitása óta
 * minden gépen jelen van, az alapértelmezéssel, felhasználói húzás nélkül is
 * (mérve, `docs/research/2026-09-24-jovahagyas-panel-helye.md` 12. szekció).
 * Azóta csak a felhasználó változtatása íródik a tárolóba, de a korábban
 * beírt alapértelmezés a kulcs meglétéből nem különíthető el. A kimondott
 * következmény: egy pontosan az alapértelmezésre visszahúzott arány (a
 * billentyűzet lépésközével elérhető) nem számít sajátnak.
 */
export function isOwnLayoutSizes(sizes: readonly number[], defaults: readonly number[]): boolean {
  return sizes.some((size, index) => size !== defaults[index]);
}
