# packages/logger

## Mi ez a mappa

A szerver naplózó rétege, `pino` és `pino-roll` felett (SPEC-006 7. és 9.2 szekció). A csomagot
kizárólag az `apps/server` fogyasztja: mit naplózunk, milyen szinten, milyen kontextussal, mit
maszkolunk, azt a SPEC-006 dönti el, ezért a `logger` nem kapott saját specifikációt (SPEC-006
7.1). A tényleges fájl rotációs `pino.transport()` hívás és a `pino.transport()`-hoz tartozó
worker szál indítása NEM ebben a csomagban áll, hanem az `apps/server` `startup-sequence`
témájában - a `logger` csomag egyetlen tesztje sem hoz létre fájlt a lemezen.

## Fájlok

| Mappa               | Felelősség                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `pino-logger/`      | a `ServerLogger` felület és a `createServerLogger` factory, befecskendezett nyelővel          |
| `secret-redaction/` | a `redact` útvonal lista, és az érték szintű törlő, ami a napló sorban cseréli a titkot       |
| `log-rotation/`     | a `pino-roll` transport opció objektumát felépítő tiszta függvény, worker szál indítás nélkül |

## Függőségi irány

L0 réteg (SPEC-002 4. szekció), workspace csomagtól nem függ. Külső függősége a `pino` és a
`pino-roll` (`docs/research/2026-08-26-toolchain.md`), ez a két csomag a monorepóban kizárólag itt
jelenik meg új függőségként - az `apps/server` is deklarálja mindkettőt, mert a `pino.transport()`
hívás ott áll (lásd fent), de az ott nem új, hanem ugyanannak a két csomagnak a második
deklarációja.

## Szabályok

**Négyrétegű titok védelem** (SPEC-006 7.4, `.claude/CLAUDE.md` 9.): a `redact` opció (dokumentált
útvonal szintaxis, `authorization`/`x-api-key` fejléc és minden tokent/kulcsot/titkot megnevező
mező), egy érték szintű törlő ami a napló sorba kerülő SZÖVEGBEN is cseréli az ismert titok
értékeket, a kérés/válasz törzs teljes kizárása a naplózásból (ez a hívó, `apps/server` dolga), és
a konfiguráció értékkel sosem naplózása. A `packages/logger` csomag tesztje bizonyítja, hogy egy
titkot tartalmazó objektum és egy titkot a szövegében hordozó hibaüzenet a nyelőre írt
bájtsorozatban a titok egyetlen előfordulását sem hagyja (SPEC-006 7.4 "Kritérium, nem ígéret").

**A `trace` szintet a csomag nem használja és nem is teszi elérhetővé** a `ServerLogger`
felületen: a SPEC-006 7.2 táblázata szerint nincs olyan esemény, ami ennél részletesebb lenne.

**A `log-rotation` téma nem indít worker szálat és nem hoz létre fájlt.** A `pino.transport({
target: 'pino-roll', options: ... })` hívás szándékosan az `apps/server` `startup-sequence`
témájában áll (lásd fent, SPEC-006 9.2).

Kódolási elvárások: nincs `any` (helyette `unknown` és typeguard), nincs `as` típuskényszerítés
(helyette `satisfies` vagy explicit típusannotáció), valódi privát mező `#` alakban.

## Kapcsolódó dokumentumok

- [`../../docs/spec/SPEC-006-szerver-alkalmazas.md`](../../docs/spec/SPEC-006-szerver-alkalmazas.md), 7. és 9.2 szekció
- [`../../docs/research/2026-08-26-toolchain.md`](../../docs/research/2026-08-26-toolchain.md): a `pino`/`pino-roll` rögzített verziója
