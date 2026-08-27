import type { Fact } from '@easter-workflow-builder/evidence';

export interface ModelDescriptor<TModelId extends string, TFamilyId extends string> {
  /**
  A modell azonosítója úgy, ahogy a kimenő body `model` mezőjében megjelenik.
  */
  readonly id: TModelId;
  readonly family: TFamilyId;
  /**
   * Amit a kliensnek ténylegesen át kell adni (`Options.model` vagy `ANTHROPIC_MODEL`).
   * Eltérhet az `id` mezőtől: a Claude Code `[1m]` suffixe a dróton lekerül a `model`
   * mezőről, viszont a kliens oldali kontextusablakot és a `context-1m-2025-08-07`
   * beta header jelenlétét ez vezérli.
   */
  readonly clientModelIdentifier: Fact<string>;
  /**
  Dokumentált kontextusablak.
  */
  readonly contextWindow: Fact<number>;
  /**
   * Q11: amit az endpoint ténylegesen kiszolgál, mérésből. **Alsó korlát**:
   * a legnagyobb sikeresen kiszolgált teljes bemeneti token szám
   * (`usage.input_tokens` + `usage.cache_read_input_tokens`), nem a pontos határ.
   */
  readonly effectiveContextWindowOnWire: Fact<number>;
  readonly maxOutputTokensRecommended: Fact<number>;
  readonly maxOutputTokensHard: Fact<number>;
  /**
   * A kimenő body `max_tokens` mezőjének kliens oldali felső korlátja. A Claude
   * Code a saját modelltáblájának cap értékére vágja le a `CLAUDE_CODE_MAX_OUTPUT_TOKENS`
   * ennél nagyobb értékét is, ezért a provider dokumentált korlátja fölé nem lehet menni.
   */
  readonly maxOutputTokensWireCeiling: Fact<number>;
  readonly imageInput: Fact<boolean>;
  readonly videoInput: Fact<boolean>;
  /**
  Q10: szerepel-e a `GET /v1/models` válaszában.
  */
  readonly listedByModelsEndpoint: Fact<boolean>;
}
