import type { MeasurementId } from './measurement-id.ts';

/**
Bizonyíték: drótszintű mérés, hivatalos dokumentáció, vagy a research fájl egy szekciója.
*/
export type EvidenceReference =
  | { readonly kind: 'measurement'; readonly id: MeasurementId }
  | { readonly kind: 'doc'; readonly url: string }
  | { readonly kind: 'research'; readonly section: string };
