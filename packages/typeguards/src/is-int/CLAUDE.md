# packages/typeguards/src/is-int

`isInt(n?: unknown): n is number` - véges szám törtrész nélkül (`n % 1 === 0`). Szándékosan
nem `Number.isSafeInteger()`-t használja, lásd az `is-int.ts` fájl saját megjegyzését.

A csomag konvencióit lásd a szülő [`../../CLAUDE.md`](../../CLAUDE.md)-ben.
