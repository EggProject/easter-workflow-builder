/**
 * A szkript törzsének csomagolása egy azonnal hívott `async` nyílfüggvénybe
 * (SPEC-014 5.4 "A szkript alakja"): a `return` értéke a lépés kimenete, a
 * törzsben `await` használható. A fordító és a futtató ugyanezt a szöveget
 * kapja, tehát a fordítási ellenőrzés pontosan azt fordítja, ami futni fog. A
 * törzs külön sorban áll, ezért a QuickJS hibájának sorszáma eggyel eltolt
 * (research `2026-11-04-szkript-csomopont.md` Q-7). A csomagolásból kitörő
 * törzs lefordul (Q-7), a PLAN-015 T-015-12 tétele.
 */
export function wrapScriptSource(source: string): string {
  return `(async () => {\n${source}\n})()`;
}
