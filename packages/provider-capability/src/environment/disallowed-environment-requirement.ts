import type { EvidenceList } from '../evidence/evidence-reference/evidence-list.ts';

/**
Env változó, amit ezzel a providerrel tilos beállítani.
*/
export interface DisallowedEnvironmentRequirement {
  readonly name: string;
  readonly reason: string;
  readonly evidence: EvidenceList;
}
