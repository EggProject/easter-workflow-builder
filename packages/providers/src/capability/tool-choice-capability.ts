import type { Fact } from '../evidence/fact.ts';
import type { ToolChoiceValue } from './tool-choice-value.ts';

export interface ToolChoiceCapability {
  /**
  Amit a provider elfogad.
  */
  readonly accepted: Fact<readonly ToolChoiceValue[]>;
  /**
  Mi történik a nem támogatott értékkel.
  */
  readonly rejectionBehaviour: Fact<'http_400' | 'silently_dropped'>;
  /**
  Q2: küld-e az SDK kényszerített értéket bármelyik fázisban.
  */
  readonly sdkSendsForcedChoice: Fact<boolean>;
}
