# A várakozás jelzései (SPEC-008 9. szekció, 35. kritérium, 2026-10-21)

Kapcsolódó: `docs/spec/SPEC-008-graf-szerkeszto-es-futas-nezet.md` 9. szekció és 15. szekció 35. kritérium;
`docs/research/2026-10-17-spec-008-kriterium-tabla.md` B. melléklet; `.claude/CLAUDE.md` 11. szekció
("Várakozás jelzése"). A megvalósítás a user 2026-10-21-i döntései szerint készült.

## 1. A futás nézet fejlécének mért magassága

A fejléc csontváza (`RunViewHeaderSkeleton`) akkor nem mozdítja el a gráf panelt a betöltés végén,
ha a magassága egyezik a valódi fejléccel. Az első változat (három csontváz sor, a design system
alapméreteivel) 68 pixel volt, a valódi fejléc 80: a gráf panel 712 pixelről 700-ra ugrott (saját
mérés, `apps/web/e2e/wait-indicators.spec.ts`, 1440x900, valódi Chromium, az `e2e` webszerver
build).

A valódi fejléc gyerekeinek mért magassága ugyanebben a nézetben: morzsasor 23, megjegyzés sor 21,
vezérlő sáv 28 pixel, a sorok közti `gap` 4 pixel (23 + 21 + 28 + 2 x 4 = 80). A csontváz sorai
ezekre a magasságokra állnak (`run-view.css`, `.run-view-screen__header-loading-row--*`, a gomb
csontváz `h={28}`). A mért értékek betűtípus és sormagasság függők, ezért a magasság egyezését a
`wait-indicators.spec.ts` "a pillanatkép betöltése alatt ..." tesztje állítja: a gráf panel mérete a
csontváz alatt és a betöltés után azonos. Más viewport szélességen (a morzsasor tördelődhet) a
magasság egyezése **nem ellenőrzött**.

## 2. A betöltés megfigyelése

A betöltés alatti állapotot késleltetett `page.route()` válasz teszi megfigyelhetővé: a kérés kapuja
(`Promise.withResolvers`) a teszt kezében van, a jelzés állapot alapú várakozással figyelhető meg,
időzítő nélkül (`skeleton-theme.spec.ts` mintája). A `rest-mock.ts` az ELSŐ illeszkedő bejegyzést
használja, ezért a késleltetett válasz bejegyzése az alapértelmezettek elé kerül.

A "lezárt pótlás mellett nincs várakozás jelzés" állítás a `replay_complete` keretet küldő lezárt
SSE válasszal fut (`mockReplay`, csak az első kapcsolatot szolgálja ki, mint a
`mockSseFramesWithoutReconnect`); a külső elválasztó húzása közben és után a lapon nulla elem
illeszkedik a `[aria-busy="true"], .is-loading, .progress-bar, [role="progressbar"], .skel`
szelektorra.

## 3. Szándékos rontás próbák

Minden rontás egy sor a termékkódban, a `wait-indicators.spec.ts` 10 tesztjével futtatva, a rontás
után `git checkout`-tal visszaállítva (saját futtatás, 2026-10-21):

| Rontás                                                                  | Bukó teszt                                                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| a Mentés gombról az `isLoading` elhagyva                                | a mentés közben a Mentés gomb betöltő állapotú                                                   |
| `isStatusLoading` mindig `false`                                        | a lépés futások betöltése alatt a csomópont állapota csontváz                                    |
| a `ProgressBar` sosem jelenik meg                                       | a pótlás alatt a transcript tetején folyamatjelző áll                                            |
| a provider választó `loading` állapota kikapcsolva                      | a provider lista betöltése alatt a mező letiltva "Betöltés…" feliratot mutat                     |
| a morzsasor csontváza kikapcsolva                                       | a gráf és a workflow neve a betöltés alatt csontvázat mutat                                      |
| a `ProgressBar` mindig megjelenik                                       | a pótlás végét jelző keret után a folyamatjelző eltűnik                                          |
| a fejléc csontváz morzsasor sora 10 pixel, a gráf csontváz `flex: none` | a pillanatkép betöltése alatt a rajz és a fejléc csontvázat mutat, a gráf panel mérete nem ugrik |

Az első öt rontás egy futásban együtt, a hatodik és a hetedik külön futásban ment; az együtt futtatott
ötből mind az öt teszt elbukott (és más nem).

## 4. Feltevések, amiket a spec és a döntések nem rögzítenek

1. **A szerkesztő morzsasorának utolsó eleme.** A workflow neve a "Szerkesztő" útvonal felirat
   HELYÉRE kerül (nem mellé); az útvonal felirata a betöltés alatt és elérhetetlen névnél
   marad (vizuálisan rejtve a csontváz mellett). A user döntése ("a workflow neve a morzsasor
   utolsó eleme") ezt a legkisebb eltérésű olvasatot adja.
2. **A provider lista hibája.** Ha a `GET /api/providers` kérés elbukik, a "Provider felülírás" mező
   a protokoll konstansából (`ProviderIdSchema.options`) kínálja a providereket, nem marad letiltva.
   A döntés nem mondja ki; az ellenkezője (a mező végleg letiltva) a felhasználót a provider
   választásban megakasztaná.
3. **A futás nézet fejlécének csontváza** addig áll, amíg a futás rekordja VAGY a pillanatkép hiányzik,
   mert a fejléc mindkettőből olvas (al-workflow útvonal, workflow neve, SDK verzió).

## 5. Merge kapu

A merge kapu eredménye a PR leírásában áll, a fej SHA-val.
