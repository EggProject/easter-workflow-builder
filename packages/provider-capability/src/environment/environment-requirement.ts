import type { EvidenceList } from '@easter-workflow-builder/evidence';

/**
 * Env követelmény. A DB soha nem tárol titkot: ha `secret: true`,
 * csak a `name` kerül perzisztálásra, az érték futásidőben a process env-ből jön.
 */
export interface EnvironmentRequirement {
  readonly name: string;
  readonly source: 'literal' | 'process_env_passthrough';
  /**
  Csak `literal` forrásnál értelmezett, és csak nem titkos értékre.
  */
  readonly literalValue?: string;
  readonly secret: boolean;
  readonly purpose: string;
  readonly evidence: EvidenceList;
}
