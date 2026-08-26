/**
 * Háromállapotú bizonyíték típus a provider képességleírókhoz.
 *
 * Alapelv: egyetlen képességmező sem kaphat tippelt értéket. Vagy `known` egy nem
 * üres bizonyítéklistával, vagy `unknown` indoklással és a blokkoló mérési esettel.
 * A `known` ág bizonyíték nélkül nem fordul le, ezt az `EvidenceList` tuple alak
 * garantálja a típusrendszer szintjén.
 *
 * Forrás: SPEC-000 5. szekció.
 */

/** Mérési eset azonosító a SPEC-000 4. szekciójából (`M-01` ... `M-18`). */
export type MeasurementId = `M-${string}`;

/** Bizonyíték: drótszintű mérés, hivatalos dokumentáció, vagy a research fájl egy szekciója. */
export type EvidenceRef =
  | { readonly kind: 'measurement'; readonly id: MeasurementId }
  | { readonly kind: 'doc'; readonly url: string }
  | { readonly kind: 'research'; readonly section: string };

/** Nem üres bizonyítéklista: legalább egy elem kötelező. */
export type EvidenceList = readonly [EvidenceRef, ...EvidenceRef[]];

/**
 * Képességmező burkoló. Az `unknown` ág nem hiba, hanem érvényes és kötelező
 * állapot mindaddig, amíg a hozzá tartozó mérés le nem zárul.
 */
export type Fact<TValue> =
  | { readonly state: 'known'; readonly value: TValue; readonly evidence: EvidenceList }
  | {
      readonly state: 'unknown';
      readonly reason: string;
      readonly blockedBy: readonly MeasurementId[];
    };

/**
 * Typeguard: a fogyasztó oldal enélkül nem olvashat `value` mezőt, mert az
 * `unknown` ágon nem létezik.
 */
export function isKnown<TValue>(
  fact: Fact<TValue>,
): fact is Extract<Fact<TValue>, { readonly state: 'known' }> {
  return fact.state === 'known';
}

/** Typeguard az ismeretlen ágra, hogy a UI kiírhassa az indoklást és a blokkoló méréseket. */
export function isUnknown<TValue>(
  fact: Fact<TValue>,
): fact is Extract<Fact<TValue>, { readonly state: 'unknown' }> {
  return fact.state === 'unknown';
}
