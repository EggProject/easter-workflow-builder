// Barrel: csak újraexport, a csomag publikus felülete csak azt adja ki, amire másik csomagnak szüksége van.

export type { MeasurementId } from './evidence-reference/measurement-id.ts';
export type { EvidenceReference } from './evidence-reference/evidence-reference.ts';
export type { EvidenceList } from './evidence-reference/evidence-list.ts';
export type { Fact } from './fact/fact.ts';
export { isKnownFact } from './fact/is-known-fact.ts';
export { isUnknownFact } from './fact/is-unknown-fact.ts';
