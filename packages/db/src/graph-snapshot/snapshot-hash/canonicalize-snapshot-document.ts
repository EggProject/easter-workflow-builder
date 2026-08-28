import { isOkOutcome, type Outcome } from '@easter-workflow-builder/core';

/**
 * A hibaosztály neve zárójelben a `message` szövegében áll, a csomag
 * `Outcome` konvenciója szerint (`packages/db/CLAUDE.md`).
 */
function nonCanonicalizable(reason: string): Outcome<string> {
  return {
    kind: 'error',
    message: `A dokumentum nem hozható kanonikus alakra: ${reason} (non_canonicalizable_value).`,
  };
}

/**
 * Tömb-e az érték. Saját guard, mert az `Array.isArray` beépített
 * predikátuma `any[]` alakra szűkít, amit a `no-unsafe-argument` szabály
 * jogosan tiltana a továbbadásnál.
 */
function isUnknownArray(value: object): value is readonly unknown[] {
  return Array.isArray(value);
}

/**
 * Sima objektum-e, tehát olyan, aminek a prototípusa `Object.prototype` vagy
 * `null` (SPEC-003 5.6, 6. pont). A `Date`, a `Map`, a `Set`, egy osztály
 * példány és a becsomagolt primitív mind elbukik ezen: a `JSON.stringify`
 * ezeket **csendben átírná** (a `toJSON` metódust hordozókat a saját kimenetükre,
 * a többit üres objektumra), ami a lenyomat mögötti tartalmat változtatná meg
 * észrevétlenül.
 */
function isPlainObject(value: object): value is Readonly<Record<string, unknown>> {
  const prototype: object | null = Reflect.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

/**
 * UTF-16 kódegység szerinti növekvő sorrend, ami betűre az RFC 8785 3.2.3
 * szabálya (F-25). A `<` operátor a stringeket az ECMA-262 szerint kódegységről
 * kódegységre hasonlítja, tehát ez a függvény pontosan azt adja, amit az
 * **alapértelmezett** (összehasonlító függvény nélküli) `Array.prototype.sort()`
 * (SPEC-003 5.6, 1. pont, plusz a 2. szekció saját ellenőrzése az
 * `['A','a','aa','b','€']` sorrenden). Azért áll itt explicit függvényként, mert
 * az összehasonlító nélküli rendezést a `unicorn/require-array-sort-compare`
 * szabály tiltja, a `sonarjs/no-alphabetical-sort` pedig `localeCompare`
 * használatát javasolná - az viszont locale függő lenne, tehát **hibás** ehhez a
 * feladathoz.
 *
 * Egyenlőség ága nincs: az egyetlen hívó az `Object.keys` kimenetét rendezi,
 * ami definíció szerint nem tartalmaz két azonos kulcsot.
 */
function compareUtf16CodeUnits(left: string, right: string): number {
  return left < right ? -1 : 1;
}

/**
 * String, szám és logikai érték: a `JSON.stringify` kimenete. Az RFC 8785 a
 * string és a szám szerializálást normatívan az ECMA-262 3.2.2.2 és 3.2.2.3
 * pontjára delegálja, amit pontosan a `JSON.stringify` valósít meg (F-25).
 * A nem véges szám és a párosítatlan surrogate string az RFC kifejezett
 * tiltása, ezért nevesített hibaág, nem csendes `null`-lá alakítás.
 */
function canonicalizePrimitive(value: string | number | boolean): Outcome<string> {
  if (typeof value === 'string') {
    return value.isWellFormed()
      ? { kind: 'ok', value: JSON.stringify(value) }
      : nonCanonicalizable('párosítatlan surrogate a szövegben');
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    return nonCanonicalizable(`nem véges szám (${String(value)})`);
  }
  return { kind: 'ok', value: JSON.stringify(value) };
}

function canonicalizeArray(value: readonly unknown[], ancestors: Set<object>): Outcome<string> {
  const parts: string[] = [];
  for (const element of value) {
    const entry = canonicalizeValue(element, ancestors);
    if (!isOkOutcome(entry)) {
      return entry;
    }
    parts.push(entry.value);
  }
  // Az elemsorrend változatlan marad, csak az elemekben álló objektumok
  // kulcsai rendeződnek (RFC 8785 3.2.3, "MUST NOT be changed").
  return { kind: 'ok', value: `[${parts.join(',')}]` };
}

/**
 * **A kimenetet ez a függvény maga fűzi össze**, kulcsonként
 * `JSON.stringify(kulcs) + ':' + kanonikus(érték)` alakban, nem pedig úgy, hogy
 * egy újraépített objektumot adna át a `JSON.stringify` hívásnak. Ez kötelező
 * megkötés, nem stílus kérdés (SPEC-003 5.6, 2. pont): az egész indexű
 * kulcsokat (`"9"`, `"10"`) a `JSON.stringify` mindig növekvő számsorrendben
 * írja ki a beszúrási sorrendtől függetlenül (F-26), az RFC 8785 viszont UTF-16
 * sorrendet ír elő, ahol a `"10"` megelőzi a `"9"` kulcsot. Egész indexű kulcs
 * a dokumentumban előfordulhat, mert a node `config` tartalma a felhasználótól
 * jön.
 */
function canonicalizePlainObject(value: Readonly<Record<string, unknown>>, ancestors: Set<object>): Outcome<string> {
  const parts: string[] = [];
  for (const key of Object.keys(value).toSorted(compareUtf16CodeUnits)) {
    const entry = canonicalizeValue(value[key], ancestors);
    if (!isOkOutcome(entry)) {
      return entry;
    }
    parts.push(`${JSON.stringify(key)}:${entry.value}`);
  }
  return { kind: 'ok', value: `{${parts.join(',')}}` };
}

function canonicalizeUnwrappedObject(value: object, ancestors: Set<object>): Outcome<string> {
  if (isUnknownArray(value)) {
    return canonicalizeArray(value, ancestors);
  }
  if (!isPlainObject(value)) {
    return nonCanonicalizable('nem sima objektum, a prototípusa nem Object.prototype és nem null');
  }
  return canonicalizePlainObject(value, ancestors);
}

/**
 * Az `ancestors` halmaz az éppen bejárt ág objektumait tartja, nem az összes
 * látottat: így a körkörös hivatkozás hibát ad, a többször hivatkozott, de
 * körmentes részfa viszont átmegy.
 */
function canonicalizeObject(value: object, ancestors: Set<object>): Outcome<string> {
  if (ancestors.has(value)) {
    return nonCanonicalizable('körkörös hivatkozás');
  }
  ancestors.add(value);
  const outcome = canonicalizeUnwrappedObject(value, ancestors);
  ancestors.delete(value);
  return outcome;
}

function canonicalizeValue(value: unknown, ancestors: Set<object>): Outcome<string> {
  if (value === null) {
    return { kind: 'ok', value: 'null' };
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return canonicalizePrimitive(value);
  }
  if (typeof value === 'object') {
    return canonicalizeObject(value, ancestors);
  }
  // `undefined` mezőérték, `bigint`, `symbol` és függvény: a `JSON.stringify`
  // az elsőt csendben eldobná, a többin hibázna vagy kihagyná a mezőt.
  return nonCanonicalizable(`a ${typeof value} típusú érték nem szerializálható JSON alakra`);
}

/**
 * A pillanatkép dokumentum RFC 8785 (JSON Canonicalization Scheme) szerinti
 * kanonikus szövege (SPEC-003 5.6). A kimenetben nincs whitespace
 * (RFC 8785 3.2.1), az objektum kulcsok rekurzívan UTF-16 sorrendben állnak, a
 * tömb elemsorrend változatlan, és minden olyan érték, amit a `JSON.stringify`
 * csendben átalakítana, `non_canonicalizable_value` hibaágat ad.
 *
 * Kivételt sosem dob.
 */
export function canonicalizeSnapshotDocument(value: unknown): Outcome<string> {
  return canonicalizeValue(value, new Set<object>());
}
