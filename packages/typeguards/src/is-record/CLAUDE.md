# packages/typeguards/src/is-record

`isRecord(value: unknown): value is Readonly<Record<string, unknown>>` - kulcs-érték
objektum, kizárva a `null`-t és a tömböket. Ismeretlen alakú JSON válasz szűkítésének első
lépése, `as` kényszerítés nélkül.

A csomag konvencióit lásd a szülő [`../../CLAUDE.md`](../../CLAUDE.md)-ben.
