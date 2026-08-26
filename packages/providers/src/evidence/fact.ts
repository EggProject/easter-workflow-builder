import type { EvidenceList } from './evidence-list.ts';
import type { MeasurementId } from './measurement-id.ts';

/**
 * Háromállapotú bizonyíték típus a provider képességleírókhoz. Vagy `known` egy
 * nem üres bizonyítéklistával, vagy `unknown` indoklással és a blokkoló mérési
 * esettel. A `known` ág bizonyíték nélkül nem fordul le, ezt az `EvidenceList`
 * tuple alak garantálja a típusrendszer szintjén. Az `unknown` ág nem hiba,
 * hanem érvényes és kötelező állapot mindaddig, amíg a hozzá tartozó mérés le
 * nem zárul.
 */
export type Fact<TValue> =
  | { readonly state: 'known'; readonly value: TValue; readonly evidence: EvidenceList }
  | {
      readonly state: 'unknown';
      readonly reason: string;
      readonly blockedBy: readonly MeasurementId[];
    };
