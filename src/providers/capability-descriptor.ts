/**
 * `ProviderCapabilityDescriptor`: egy provider drótszintű képességeinek leírója.
 *
 * Minden képességmező `Fact<T>` burkolóban van, tehát bizonyíték nélkül nem tölthető ki.
 * A modellazonosító és a modellcsalád generikus paraméter, hogy minden provider a
 * saját, szűk literál uniójával dolgozzon.
 *
 * Forrás: SPEC-000 5. szekció.
 */
import type { EvidenceList, Fact } from './fact.ts';

/** A projekt két strukturált kimenet stratégiája. */
export type StructuredOutputStrategyId = 'emit_output_tool' | 'sdk_output_format';

export interface StructuredOutputStrategy {
  readonly id: StructuredOutputStrategyId;
  /** Használható-e ezzel a providerrel. */
  readonly usable: Fact<boolean>;
  /** Ha nem használható: melyik konkrét drótrészlet blokkolja. `null`, ha nincs blokkoló. */
  readonly blockingWireDetail: Fact<string | null>;
  /** Hány modellkör kellett a kikényszerítéshez a mérésben. */
  readonly observedRoundTrips: Fact<readonly number[]>;
}

export interface StructuredOutputCapability {
  readonly strategies: readonly StructuredOutputStrategy[];
  readonly defaultStrategy: Fact<StructuredOutputStrategyId>;
  /** Q3: kimegy-e `output_config` akkor is, ha nem kérünk strukturált kimenetet. */
  readonly outputConfigAlwaysSent: Fact<boolean>;
  /** Q3: melyik body mezőben utazik az `effort`, ha egyáltalán. */
  readonly outputConfigWireField: Fact<string | null>;
}

/** `tool_choice`: a MiniMax szűk enumja miatt külön mező. */
export type ToolChoiceValue = 'auto' | 'none' | 'any' | 'tool';

export interface ToolChoiceCapability {
  /** Amit a provider elfogad. */
  readonly accepted: Fact<readonly ToolChoiceValue[]>;
  /** Mi történik a nem támogatott értékkel. */
  readonly rejectionBehaviour: Fact<'http_400' | 'silently_dropped'>;
  /** Q2: küld-e az SDK kényszerített értéket bármelyik fázisban. */
  readonly sdkSendsForcedChoice: Fact<boolean>;
}

/**
 * Thinking módok. A modellcsaládonkénti bontás a típus általános része marad,
 * mert más provider több családot is hozhat.
 */
export type ThinkingMode = 'disabled' | 'adaptive' | 'always_on';

export interface ThinkingCapability<TFamilyId extends string> {
  readonly byModelFamily: Readonly<Record<TFamilyId, Fact<readonly ThinkingMode[]>>>;
  /** Q4: a kimenő `thinking` mező pontos JSON alakja, szó szerint. */
  readonly wireShape: Fact<string>;
  /** Küld-e az SDK `budget_tokens` kulcsot, amit a provider sémája nem ismer. */
  readonly sendsBudgetTokens: Fact<boolean>;
  /** Interleaved thinking: vissza kell-e adni a thinking blokkot signature-rel. */
  readonly interleavedSignatureRequired: Fact<boolean>;
  /** A stream thinking eventjeinek típusai. */
  readonly streamEventTypes: Fact<readonly string[]>;
}

export interface EffortCapability {
  /** Elfogadja-e a provider a kérést, ha az `effort` be van állítva. */
  readonly accepted: Fact<boolean>;
  /** Melyik body mezőben jelenik meg. `null`, ha nem megy ki a dróton. */
  readonly wireField: Fact<string | null>;
}

export type PromptCacheMode = 'none' | 'implicit' | 'explicit' | 'implicit_and_explicit';

export interface PromptCachingCapability {
  readonly mode: Fact<PromptCacheMode>;
  readonly explicitBreakpointLimit: Fact<number>;
  readonly ttlSeconds: Fact<number>;
  readonly minimumInputTokens: Fact<number>;
  /** A válasz `usage` objektumában megfigyelt cache mezők nevei. */
  readonly usageFields: Fact<readonly string[]>;
  /** Az env változó, amivel a kliens oldali cache jelölés kikapcsolható. */
  readonly disableEnvVar: Fact<string | null>;
  /**
   * Kimegy-e a dróton a hívó fél által kézzel, egy content blokkra rakott
   * `cache_control` jelölés akkor is, ha a `disableEnvVar` be van állítva.
   * Ha igen, a kapcsoló csak az SDK saját, automatikus töréspontjait veszi le,
   * tehát a prompt cache egy része a hívó fél kezében marad.
   */
  readonly callerBreakpointSurvivesDisable: Fact<boolean>;
}

export interface StreamingCapability {
  readonly sse: Fact<boolean>;
  /** Q7: milyen alakban érkezik a tool argumentum. */
  readonly toolInputDelta: Fact<
    'input_json_delta' | 'whole_input_in_content_block_start' | 'other'
  >;
  /** Q7: az SDK helyesen rakja-e össze a tool inputot. Bájtszintű összevetés eredménye. */
  readonly sdkReassemblesToolInput: Fact<boolean>;
  /** Nem-first-party base URL mellett az SDK kikapcsolja. */
  readonly fineGrainedToolStreaming: Fact<boolean>;
  /**
   * Kikapcsolható-e a kimenő kérés `stream` mezője. Ez SDK szintű tulajdonság,
   * nem a provideré: ha az `Options` típusban nincs ilyen mező, a nem stream
   * válasz `usage` objektuma ezen az úton nem figyelhető meg.
   */
  readonly streamDisableable: Fact<boolean>;
}

export interface ServerToolDescriptor {
  /** A body `tools[].type` értéke, ahogy a dróton megjelenne. */
  readonly wireType: string;
  readonly name: string;
  /** Elérhető-e a mi hívási utunkon, nem elméletben. */
  readonly available: Fact<boolean>;
}

export interface ModelDescriptor<TModelId extends string, TFamilyId extends string> {
  /** A modell azonosítója úgy, ahogy a kimenő body `model` mezőjében megjelenik. */
  readonly id: TModelId;
  readonly family: TFamilyId;
  /**
   * Amit a kliensnek ténylegesen át kell adni (`Options.model` vagy `ANTHROPIC_MODEL`).
   * Eltérhet az `id` mezőtől: a Claude Code `[1m]` suffixe a dróton lekerül a `model`
   * mezőről, viszont a kliens oldali kontextusablakot és a `context-1m-2025-08-07`
   * beta header jelenlétét ez vezérli.
   */
  readonly clientModelIdentifier: Fact<string>;
  /** Dokumentált kontextusablak. */
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
  /** Q10: szerepel-e a `GET /v1/models` válaszában. */
  readonly listedByModelsEndpoint: Fact<boolean>;
}

/**
 * A `GET /v1/models` végpont. Külön mezőcsoport, mert a "lekérhető" és a
 * "az SDK le is kéri" két különböző dolog, és a Kapcsolat teszt gomb terve a
 * kettő különbségén áll.
 */
export interface ModelsEndpointCapability {
  /** Válaszol-e a végpont közvetlen, SDK-n kívüli HTTP hívásra. */
  readonly directHttpReachable: Fact<boolean>;
  /** Meghívja-e az SDK saját maga ezt az útvonalat a mért konfigurációban. */
  readonly calledBySdk: Fact<boolean>;
  /** A válasz `data` tömbjének hossza, ha a végpont válaszolt. */
  readonly listedModelCount: Fact<number>;
}

export interface RateLimitBucket<TModelId extends string> {
  readonly appliesTo: readonly TModelId[];
  readonly requestsPerMinute: Fact<number>;
  readonly tokensPerMinute: Fact<number>;
}

export interface RateLimitCapability<TModelId extends string> {
  readonly buckets: readonly RateLimitBucket<TModelId>[];
  /** Küld-e a provider `Retry-After` headert 429-nél. */
  readonly retryAfterHeader: Fact<string | null>;
  /** Minden megfigyelt rate limit jellegű header neve. */
  readonly rateLimitHeaders: Fact<readonly string[]>;
}

/**
 * Kliens oldali párhuzamosság. Azért providerenkénti mező, mert a megfigyelt
 * egyidejű kérésszám közvetlenül a provider percenkénti kérés korlátjába számít bele.
 */
export interface ConcurrencyCapability {
  /** Az env változó, ami a kliens belső subagent párhuzamosságát korlátozza. */
  readonly subagentCapEnvVar: Fact<string | null>;
  /** A fenti env változó értéke, amivel a megfigyelés készült. */
  readonly measuredSubagentCap: Fact<number>;
  /**
   * A megfigyelt legnagyobb egyidejűleg nyitva lévő kimenő kérésszám egyetlen
   * `query()` alatt, a fenti korlát mellett. A subagentek kérésein felül az
   * orchestrátor saját kérése is beleszámít.
   */
  readonly observedMaxConcurrentRequests: Fact<number>;
}

/**
 * Env követelmény. A DB soha nem tárol titkot: ha `secret: true`,
 * csak a `name` kerül perzisztálásra, az érték futásidőben a process env-ből jön.
 */
export interface EnvRequirement {
  readonly name: string;
  readonly source: 'literal' | 'process_env_passthrough';
  /** Csak `literal` forrásnál értelmezett, és csak nem titkos értékre. */
  readonly literalValue?: string;
  readonly secret: boolean;
  readonly purpose: string;
  readonly evidence: EvidenceList;
}

/** Env változó, amit ezzel a providerrel tilos beállítani. */
export interface DisallowedEnvRequirement {
  readonly name: string;
  readonly reason: string;
  readonly evidence: EvidenceList;
}

export interface ProviderCapabilityDescriptor<
  TModelId extends string,
  TFamilyId extends string,
> {
  readonly id: 'claude-subscription' | 'minimax';
  readonly displayName: string;
  /** Az SDK verzió, amivel a leíró érvényes. Frissítés előtt regresszió kell. */
  readonly sdkVersionPin: string;
  readonly measuredAt: string;
  readonly requiredEnv: readonly EnvRequirement[];
  readonly disallowedEnv: readonly DisallowedEnvRequirement[];
  readonly structuredOutput: StructuredOutputCapability;
  readonly toolChoice: ToolChoiceCapability;
  readonly thinking: ThinkingCapability<TFamilyId>;
  readonly effort: EffortCapability;
  readonly promptCaching: PromptCachingCapability;
  readonly streaming: StreamingCapability;
  readonly serverTools: Fact<readonly ServerToolDescriptor[]>;
  readonly models: readonly ModelDescriptor<TModelId, TFamilyId>[];
  readonly modelsEndpoint: ModelsEndpointCapability;
  readonly rateLimits: RateLimitCapability<TModelId>;
  readonly concurrency: ConcurrencyCapability;
  /** Q12: a kimenő `anthropic-beta` header elemei. */
  readonly anthropicBetaHeaders: Fact<readonly string[]>;
}
