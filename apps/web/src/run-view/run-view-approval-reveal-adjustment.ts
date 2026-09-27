import type { RunViewLayoutBand } from './run-view-layout-band.ts';

/**
 * Mozdulhat-e ideiglenesen a BELSŐ (transcript vs. jóváhagyás szövege)
 * elválasztó egy függő jóváhagyás felfedése kedvéért, a jelenlegi
 * reszponzív SÁVTÓL függően (`run-view-layout-band.ts`, SPEC-008 10.
 * szekció).
 *
 * MIÉRT FÜGG A SÁVTÓL. A futás nézetnek két húzható elválasztója van: a
 * KÜLSŐ (gráf vs. transcript, `run-view-layout.ts`) és ez, a BELSŐ
 * (transcript vs. jóváhagyás szövege, `run-view-approval-layout.ts`). A
 * kettő viszonya sávonként eltérő:
 *
 * - `vertical` sávban (a `--ep-screen-md` és a `--ep-screen-lg` között,
 *   ahol a gráf a transcript FÖLÖTT áll) a két elválasztó UGYANAZON a
 *   tengelyen áll, tehát a KÜLSŐ ténylegesen tud helyet adni a BELSŐNEK
 *   (SPEC-008 8. szekció 1. pont: "előbb a gráf és a transcript közti
 *   elválasztó ad helyet ... a maradékot a belső elválasztó fizeti"). Itt
 *   ezért a régi szabály marad: a belső akkor mozdul ideiglenesen, ha a
 *   belső VAGY a külső arány nem saját (user döntés 2026-09-26,
 *   "Ideiglenesen engedjen").
 * - `horizontal` sávban (a `--ep-screen-lg` és fölötte, a gráf és a
 *   transcript EGYMÁS MELLETT) a két elválasztó MÁS tengelyen áll (a külső
 *   vízszintes, a belső függőleges), tehát a külső nem tud helyet adni a
 *   belsőnek (SPEC-008 8. szekció 1. pont: "a vízszintes és a fül sávban a
 *   külső nem ad helyet ... ott csak a belső enged").
 * - `tabs` sávban (a `--ep-screen-md` alatt) NINCS is külső elválasztó,
 *   csak `Tabs` komponens (`RunViewLayout.tsx`); a külső arány kulcsa
 *   ezen a képernyőn nem is értelmezhető.
 *
 * A KÜLSŐ ARÁNY KULCSA EZÉRT LÁTHATATLAN/IRRELEVÁNS `horizontal` és `tabs`
 * sávban: egy korábban, MÁSIK sávban (`vertical`) beállított saját külső
 * arány semmit nem jelent ezen a két sávon, mert ott a külső elválasztó
 * vagy más tengelyen áll, vagy nincs is. A korábbi, sávtól független
 * szabály (`storedApprovalLayoutSizes === undefined || storedLayoutSizes
 * === undefined`) ennek ellenére figyelembe vette: ha a usernek volt saját
 * KÜLSŐ aránya (mert korábban `vertical` sávban beállította) ÉS saját
 * BELSŐ aránya is, a belső elválasztó `horizontal`/`tabs` sávban NEM
 * engedett, holott a kérdésnek ki kellene férnie.
 *
 * MÉRT "ELŐTTE" VISELKEDÉS (egy független ellenőrzés, a `main` `67c06a2`
 * állapotán, saját BELSŐ ÉS saját KÜLSŐ aránnyal): 1440x600-on
 * (`horizontal` sáv) a figyelmeztetés, a cím és a szöveg 0/0/0 arányban
 * látszott (a szöveg levágódott); 375x812-n (`tabs` sáv) 0,05/0 arányban.
 * Csak saját belső aránnyal, külső arány nélkül mindhárom 1/1/1 volt,
 * tehát a hiba kizárólag a KÉT saját arány EGYÜTTES jelenlétén állt.
 *
 * A DÖNTÉS (user döntés 2026-09-27, "Csak a látható arány számít",
 * SPEC-008 8. szekció 1. pont): `horizontal` és `tabs` sávban KIZÁRÓLAG a
 * belső saját arány számít, a külső kulcsa nem. A `vertical` sávban a
 * fenti indok miatt (a két elválasztó azonos tengelyen áll, a külső
 * ténylegesen ad helyet a belsőnek) a régi szabály változatlan marad.
 *
 * **Ellenőrzött hivatkozás, forrás pontosítás.** A SPEC-008 14.2 táblázat
 * O-9 tétele NEM erről a kérdésről szól (az a jóváhagyás panel HELYÉRŐL,
 * nem az `adjustsForReveal` sávfüggő kapujáról), és jelen módosítás idején
 * (2026-09-27) még nyitott, a 14.2, nem a 14.1 táblázatban áll: ide ezért
 * nem került be hivatkozásként. Az egyetlen releváns forrás a SPEC-008 8.
 * szekció 1. pontja, ami már most is kimondja a `vertical` kontra
 * `horizontal`/fül sáv tengelykülönbséget, csak eddig az `adjustsForReveal`
 * kapuban ez nem tükröződött.
 *
 * A tárolt belső arányt ez a függvény nem írja felül: a `packages/ui`
 * `Resizable` `reveal`/`adjustsForReveal` mechanizmusa csak IDEIGLENESEN
 * enged, a jóváhagyás eltűnése után a tárolt arányra áll vissza. Ez a
 * függvény kizárólag azt dönti el, MIKOR legyen az `adjustsForReveal` prop
 * igaz.
 *
 * Kimerítő `switch` a `band` paraméteren, `default` ág nélkül (lásd
 * `is-run-closing-frame.ts` azonos mintáját): a `switch-exhaustiveness-check`
 * szabály miatt egy negyedik `RunViewLayoutBand` érték felvétele itt
 * fordítási hibát (TS2366) és lint hibát ad, tehát nem maradhat csendben
 * besorolatlan.
 */
/* eslint-disable-next-line unicorn/consistent-boolean-name -- a `resolve` előtag szándékos, a sávválasztó `resolveRunViewLayoutBand` (`run-view-layout-band.ts`) és a jóváhagyás választó `select-shown-approval.ts` melletti, a `band` paraméter szerint elágazó ELDÖNTÉS neve, nem egyetlen feltétel kérdése; a `packages/engine` `resolveForkSession` ugyanezzel az indokkal tér el a szabálytól (`resolve-fork-session.ts`) */
export function resolveApprovalRevealAdjustment(
  band: RunViewLayoutBand,
  storedApprovalLayoutSizes: readonly number[] | undefined,
  storedLayoutSizes: readonly number[] | undefined,
): boolean {
  switch (band) {
    case 'vertical': {
      return storedApprovalLayoutSizes === undefined || storedLayoutSizes === undefined;
    }
    case 'horizontal':
    case 'tabs': {
      return storedApprovalLayoutSizes === undefined;
    }
  }
}
