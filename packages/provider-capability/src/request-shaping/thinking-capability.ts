import type { Fact } from '@easter-workflow-builder/evidence';
import type { ThinkingMode } from './thinking-mode.ts';

export interface ThinkingCapability<TFamilyId extends string> {
  readonly byModelFamily: Readonly<Record<TFamilyId, Fact<readonly ThinkingMode[]>>>;
  /**
  Q4: a kimenő `thinking` mező pontos JSON alakja, szó szerint.
  */
  readonly wireShape: Fact<string>;
  /**
  Küld-e az SDK `budget_tokens` kulcsot, amit a provider sémája nem ismer.
  */
  readonly sendsBudgetTokens: Fact<boolean>;
  /**
  Interleaved thinking: vissza kell-e adni a thinking blokkot signature-rel.
  */
  readonly interleavedSignatureRequired: Fact<boolean>;
  /**
  A stream thinking eventjeinek típusai.
  */
  readonly streamEventTypes: Fact<readonly string[]>;
}
