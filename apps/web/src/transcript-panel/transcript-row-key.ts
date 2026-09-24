import type { TranscriptRow } from './transcript-row.ts';

/**
 * A lista `rowKey` propja: a sor React kulcsa a sor saját `key` mezője
 * (`transcript-row.ts`), nem a sorszáma.
 *
 * A telepített `react-window@2.3.1` `.d.ts` szövege szerint "Lists use the
 * row index as a `key` by default", a `List` törzse pedig
 * `key: d ? d(w, h) : w` alakban kulcsol (`dist/react-window.js`; `d` a
 * `rowKey`, `w` a sorszám, `h` a `rowProps`), tehát `rowKey` nélkül a lista
 * eleme a sorszámhoz kötődik, nem a sorhoz. Ha egy sor más sorszámra kerül, a
 * lista elem nem követi: a benne álló `RunEventRow` a sor saját kulcsa miatt
 * újracsatolódik, és a kinyitott `AccordionItem` állapota elvész (mérve a
 * `TranscriptPanel.spec.tsx` kulcs tesztjével, a `rowKey` törlésével).
 * A propot a könyvtár render közben hívja, és a doksi szerint stabil
 * függvény kell ("always `useCallback` for this prop; do not use an inline
 * function", <https://react-window.vercel.app/list/props>); a modul szintű
 * függvény ezt kiváltja.
 *
 * A sor a `slice` plusz `map` párossal kerül elő, nem indexeléssel, ugyanazért,
 * amiért a sor komponensben: az `index` a lista szerződése szerint mindig a
 * `rowCount` alatt van, tehát egy `rows[index] === undefined` ág garantáltan
 * sosem futna (`.claude/CLAUDE.md` 5. szekció). A szelet pontosan egy elemű,
 * így az összefűzése a sor kulcsa.
 */
export function transcriptRowKey(index: number, rowProperties: Readonly<{ rows: readonly TranscriptRow[] }>): string {
  return rowProperties.rows
    .slice(index, index + 1)
    .map((row) => row.key)
    .join('');
}
