import type { ProviderId } from '@easter-workflow-builder/provider-capability';

/**
 * A providerenkénti párhuzamossági korlát lekérdezése, amit a szabályozó
 * **minden döntése előtt** meghív (SPEC-004 7.3): "A motor kizárólag a
 * `provider_concurrency_limit` táblából olvas korlátot. Ha egy providerhez
 * nincs sor, a motor nem alkalmaz saját korlátot."
 *
 * A `null` valódi adat, nem helyőrző: azt jelenti, hogy a providerhez nincs
 * beállított korlát, tehát a szabályozó azt a providert **soha nem
 * korlátozza**. Ugyanaz az alak, mint a `db` csomag
 * `ProviderConcurrencyRepository.readLimit` visszatérésének értéke, tehát a
 * hívó átalakítás nélkül adhatja tovább.
 *
 * **Miért függvény és nem a létrehozáskor átvett térkép.** A SPEC-003 11. szekciója szerint a felhasználó által beállított érték "azonnal érvénybe
 * lép", a motor viszont egyetlen `createEngine` híváskor jön létre: egy
 * létrehozáskor befagyasztott térkép a korlát változását csak
 * szerverújraindítás után engedné érvényre jutni, ami kitalált megkötés
 * lenne. A függvényt a hívó (`run-supervisor`) adja, ami a `database` porton
 * át olvassa az aktuális értéket.
 *
 * **Miért nem tizedik port.** A motor kilenc portot kap, és a lista zárt
 * (SPEC-004 3.2). Ez a lekérdezés nem port, hanem a `createConcurrencyGate`
 * paramétere: a szabályozót a motor állítja össze a már meglévő `database`
 * portból, tehát a `concurrency-gate` téma egyetlen sora sem érint
 * adatbázist.
 */
export type ConcurrencyLimitLookup = (providerId: ProviderId) => number | null;
