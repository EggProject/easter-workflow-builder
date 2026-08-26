import type { EvidenceReference } from './evidence-reference.ts';

/**
Nem üres bizonyítéklista: legalább egy elem kötelező.
*/
export type EvidenceList = readonly [EvidenceReference, ...EvidenceReference[]];
