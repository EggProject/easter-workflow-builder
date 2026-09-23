/**
 * Olcsó, TypeScript parser nélküli előszűrő a relatív import specifikátorokhoz.
 *
 * Miért kell: a `findRelativeImportSpecifiers` teljes TypeScript AST-t épít,
 * a gyökér `bun run test` pedig V8 coverage alatt fut, ami a `typescript`
 * csomag kódját is műszerezi, így a teljes repó parse-a a teszt időkorlát
 * közelébe ért (`docs/research/2026-09-23-teszt-idokorlat-bombak.md`).
 * Ez a függvény csak szövegkereséssel dolgozik, a hívó pedig kizárólag
 * akkor futtatja a pontos, parser alapú kinyerést, ha egy jelölt gyanús.
 *
 * A garancia, amire a hívók építenek: minden relatív modul specifikátor,
 * amit a `findRelativeImportSpecifiers` kinyer (az `import`/`export ... from`
 * deklarációé és a dinamikus `import()` hívás string literál argumentuma),
 * `StringLiteral` token, aminek a feldolgozott értéke `./` vagy `../`
 * kezdetű. Ha a nyers alakjában nincs visszaperjel és sortörés, a nyers
 * és a feldolgozott érték bájtra azonos, tehát a szövegben idézőjel, `./`
 * vagy `../`, majd ugyanaz az idézőjel alakban áll, és az alábbi keresés
 * megtalálja, mert mindkét idézőjel MINDEN előfordulását külön vizsgálja.
 * Minden más esetben (visszaperjel a jelölt elején vagy belsejében,
 * sortörés, lezáratlan idézőjel) a visszatérési érték `undefined`, és a
 * hívónak a pontos kinyerést kell futtatnia. A jelöltlista tehát a
 * tényleges specifikátorok bővebb halmaza: kommentből vagy más sztringből
 * is kerülhet bele jelölt, ami legfeljebb egy fölösleges pontos kinyerést
 * okoz, hiányt nem.
 */

// A TypeScript szkenner a `'` és a `"` karakterrel nyit `StringLiteral`
// tokent; az import deklaráció modul specifikátora és a pontos kinyerés által
// látott dinamikus `import()` argumentum csak ilyen lehet. A template literál
// argumentumot a pontos kinyerés sem látja, ezért a backtick itt nem kell.
const QUOTES = ["'", '"'];

// Visszaperjellel kezdődő nyers alak (`\x2e/`, `.\/`, `..\/` és társaik)
// feldolgozva is adhat `./` vagy `../` kezdetet, ezért nem dönthető el
// szövegkereséssel.
const ESCAPED_START_PATTERN = /^\.{0,2}\\/;

// A TypeScript 6 szkennere (`scanString`) a sztringet a `\n` és a `\r`
// karakternél lezáratlanként megszakítja, a visszaperjel pedig escape
// szekvenciát nyit: ezekben az esetekben a nyers és a feldolgozott érték
// eltérhet.
const RAW_DIFFERS_FROM_COOKED_PATTERN = /[\\\n\r]/;

// Egyetlen idézőjel karakter minden előfordulását nyitó idézőjelnek tekinti,
// és visszaadja a `./` vagy `../` kezdetű jelölteket; `undefined`, ha
// valamelyik jelölt szövegkereséssel nem dönthető el.
function findCandidatesAfterQuote(sourceText: string, quote: string): readonly string[] | undefined {
  const candidates: string[] = [];

  for (let open = sourceText.indexOf(quote); open !== -1; open = sourceText.indexOf(quote, open + 1)) {
    const start = sourceText.slice(open + 1, open + 4);
    if (ESCAPED_START_PATTERN.test(start)) {
      return undefined;
    }
    if (!start.startsWith('./') && !start.startsWith('../')) {
      continue;
    }

    const close = sourceText.indexOf(quote, open + 1);
    const candidate = sourceText.slice(open + 1, close);
    if (close === -1 || RAW_DIFFERS_FROM_COOKED_PATTERN.test(candidate)) {
      return undefined;
    }
    candidates.push(candidate);
  }

  return candidates;
}

export function findRelativeSpecifierCandidates(sourceText: string): readonly string[] | undefined {
  const candidates: string[] = [];

  for (const quote of QUOTES) {
    const quoteCandidates = findCandidatesAfterQuote(sourceText, quote);
    if (quoteCandidates === undefined) {
      return undefined;
    }
    candidates.push(...quoteCandidates);
  }

  return candidates;
}
