import type { EvidenceList } from '@easter-workflow-builder/evidence';

/**
Env változó, amit ezzel a providerrel tilos beállítani.
*/
export interface DisallowedEnvironmentRequirement {
  readonly name: string;
  readonly reason: string;
  readonly evidence: EvidenceList;
}
