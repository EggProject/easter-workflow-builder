/**
 * A `claude-subscription` provider képességleírója.
 *
 * FONTOS: ezt a providert a SPEC-000 1. szekciója szerint NEM mértük drótszinten,
 * mert first-party base URL-t és bejelentkezésen alapuló hitelesítést használ.
 * Ezért itt minden `known` mező mögött hivatalos Anthropic dokumentáció áll, és
 * minden olyan mező `unknown`, ami csak méréssel dönthető el. A MiniMax leíró
 * értékei ide NEM másolhatók át.
 *
 * A `measuredAt` itt a dokumentáció-ellenőrzés dátuma, nem drótszintű mérésé.
 */
import type { ProviderCapabilityDescriptor } from './capability-descriptor.ts';

/** A Claude Code előfizetéses úton elérhető modellek a projekt hatókörében. */
export type ClaudeModelId = 'claude-opus-5' | 'claude-sonnet-5' | 'claude-haiku-4-5';

/** Modellcsaládok. */
export type ClaudeFamilyId = 'opus' | 'sonnet' | 'haiku';

const DOC_MODELS = 'https://platform.claude.com/docs/en/models/overview';
const DOC_TOOL_USE = 'https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview';
const DOC_STRUCTURED = 'https://platform.claude.com/docs/en/build-with-claude/structured-outputs';
const DOC_EFFORT = 'https://platform.claude.com/docs/en/build-with-claude/effort';
const DOC_THINKING = 'https://platform.claude.com/docs/en/build-with-claude/thinking';
const DOC_THINKING_STEER =
  'https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost';
const DOC_CACHING = 'https://platform.claude.com/docs/en/build-with-claude/prompt-caching';
const DOC_STREAMING = 'https://platform.claude.com/docs/en/build-with-claude/streaming';
const DOC_WEB_SEARCH =
  'https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool';
const DOC_VISION = 'https://platform.claude.com/docs/en/build-with-claude/vision';
const DOC_MODELS_LIST = 'https://platform.claude.com/docs/en/api/models/list';
const DOC_ENV_VARS = 'https://code.claude.com/docs/en/env-vars';

const RESEARCH_GATEWAY = '2026-08-26-agent-sdk-minimax.md 3. szekció, nem-Anthropic endpoint';

export const claudeSubscriptionProvider = {
  id: 'claude-subscription',
  displayName: 'Claude Code előfizetés',
  sdkVersionPin: '0.3.245',
  measuredAt: '2026-08-26',

  // Az előfizetéses út a Claude Code bejelentkezésből veszi a hitelesítést,
  // ezért nincs kötelező env változó.
  requiredEnv: [],

  disallowedEnv: [
    {
      name: 'ANTHROPIC_BASE_URL',
      reason:
        'Felülírja az endpointot. Ezzel a provider definíció szerint megszűnik first-party lenni, tehát nem ez a provider futna.',
      evidence: [{ kind: 'research', section: RESEARCH_GATEWAY }],
    },
  ],

  structuredOutput: {
    strategies: [
      {
        id: 'emit_output_tool',
        usable: {
          state: 'unknown',
          reason:
            'A SPEC-000 1. szekciója szerint ezt a providert nem mértük drótszinten, és a Stop hook kikényszerítés MiniMax ellen sem bizonyított.',
          blockedBy: ['M-10'],
        },
        blockingWireDetail: {
          state: 'unknown',
          reason: 'Nincs drótszintű mérés ehhez a providerhez.',
          blockedBy: ['M-10'],
        },
        observedRoundTrips: {
          state: 'unknown',
          reason: 'Nincs drótszintű mérés ehhez a providerhez.',
          blockedBy: ['M-10'],
        },
      },
      {
        id: 'sdk_output_format',
        // Az Anthropic Messages API natívan támogatja a strukturált kimenetet.
        usable: {
          state: 'known',
          value: true,
          evidence: [{ kind: 'doc', url: DOC_STRUCTURED }],
        },
        blockingWireDetail: {
          state: 'known',
          value: null,
          evidence: [{ kind: 'doc', url: DOC_STRUCTURED }],
        },
        observedRoundTrips: {
          state: 'unknown',
          reason: 'Nincs drótszintű mérés ehhez a providerhez.',
          blockedBy: ['M-02', 'M-03'],
        },
      },
    ],
    defaultStrategy: {
      state: 'known',
      value: 'sdk_output_format',
      evidence: [{ kind: 'doc', url: DOC_STRUCTURED }],
    },
    outputConfigAlwaysSent: {
      state: 'unknown',
      reason: 'Nincs drótszintű mérés ehhez a providerhez.',
      blockedBy: ['M-01', 'M-04'],
    },
    outputConfigWireField: {
      state: 'known',
      value: 'output_config.effort',
      evidence: [
        { kind: 'doc', url: DOC_EFFORT },
        { kind: 'doc', url: DOC_THINKING_STEER },
      ],
    },
  },

  toolChoice: {
    accepted: {
      state: 'known',
      value: ['auto', 'none', 'any', 'tool'],
      evidence: [{ kind: 'doc', url: DOC_TOOL_USE }],
    },
    rejectionBehaviour: {
      state: 'unknown',
      reason:
        'Mind a négy érték támogatott, ezért nincs olyan bemenet, amivel az elutasítási viselkedés kiderülne. Nem mértük.',
      blockedBy: ['M-03'],
    },
    sdkSendsForcedChoice: {
      state: 'unknown',
      reason: 'Nincs drótszintű mérés ehhez a providerhez.',
      blockedBy: ['M-03'],
    },
  },

  thinking: {
    // Az aktuális modellgeneráció adaptív thinkinget használ, a régi fix budget
    // (type: enabled, budget_tokens) mód a legacy manual módhoz tartozik.
    byModelFamily: {
      opus: {
        state: 'known',
        value: ['disabled', 'adaptive'],
        evidence: [
          { kind: 'doc', url: DOC_THINKING },
          { kind: 'doc', url: DOC_THINKING_STEER },
        ],
      },
      sonnet: {
        state: 'known',
        value: ['disabled', 'adaptive'],
        evidence: [
          { kind: 'doc', url: DOC_THINKING },
          { kind: 'doc', url: DOC_THINKING_STEER },
        ],
      },
      haiku: {
        state: 'known',
        value: ['disabled', 'adaptive'],
        evidence: [
          { kind: 'doc', url: DOC_THINKING },
          { kind: 'doc', url: DOC_THINKING_STEER },
        ],
      },
    },
    wireShape: {
      state: 'unknown',
      reason:
        'A dokumentáció példája {"type":"adaptive","display":"summarized"} alakot mutat, de hogy a Claude Code pontosan mit küld ezen az úton, nem mértük.',
      blockedBy: ['M-05', 'M-06'],
    },
    sendsBudgetTokens: {
      state: 'unknown',
      reason: 'Nincs drótszintű mérés ehhez a providerhez.',
      blockedBy: ['M-05'],
    },
    interleavedSignatureRequired: {
      state: 'unknown',
      reason:
        'Az interleaved thinking dokumentáltan beta header nélkül működik, de a thinking blokk visszaadási kötelezettsége modellenként eltér, és ezt nem mértük.',
      blockedBy: ['M-05'],
    },
    streamEventTypes: {
      state: 'known',
      value: ['content_block_start', 'thinking_delta', 'signature_delta', 'content_block_stop'],
      evidence: [{ kind: 'doc', url: DOC_STREAMING }],
    },
  },

  effort: {
    accepted: {
      state: 'known',
      value: true,
      evidence: [{ kind: 'doc', url: DOC_EFFORT }],
    },
    wireField: {
      state: 'known',
      value: 'output_config.effort',
      evidence: [
        { kind: 'doc', url: DOC_EFFORT },
        { kind: 'doc', url: DOC_THINKING_STEER },
      ],
    },
  },

  promptCaching: {
    mode: {
      state: 'known',
      value: 'explicit',
      evidence: [{ kind: 'doc', url: DOC_CACHING }],
    },
    explicitBreakpointLimit: {
      state: 'known',
      value: 4,
      evidence: [{ kind: 'doc', url: DOC_CACHING }],
    },
    ttlSeconds: {
      state: 'known',
      value: 300,
      evidence: [{ kind: 'doc', url: DOC_CACHING }],
    },
    // A minimum token küszöb modellenként eltér (512 / 1024 / 2048 / 4096), a mező
    // viszont egyetlen számot vár. Ezt a típusrésést jelezni kell, nem elfedni.
    minimumInputTokens: {
      state: 'unknown',
      reason:
        'A minimum cacheelhető input token modellenként eltér (a dokumentáció 512, 1024, 2048 és 4096 értékeket sorol fel modellcsoportonként), a mező viszont egyetlen számot vár. A típust modellenkénti bontásra kell javítani, mielőtt ez a mező kitölthető.',
      blockedBy: ['M-15'],
    },
    usageFields: {
      state: 'known',
      value: ['cache_creation_input_tokens', 'cache_read_input_tokens'],
      evidence: [{ kind: 'doc', url: DOC_CACHING }],
    },
    disableEnvVar: {
      state: 'known',
      value: 'DISABLE_PROMPT_CACHING',
      evidence: [{ kind: 'doc', url: DOC_ENV_VARS }],
    },
  },

  streaming: {
    sse: {
      state: 'known',
      value: true,
      evidence: [{ kind: 'doc', url: DOC_STREAMING }],
    },
    toolInputDelta: {
      state: 'known',
      value: 'input_json_delta',
      evidence: [{ kind: 'doc', url: DOC_STREAMING }],
    },
    sdkReassemblesToolInput: {
      state: 'unknown',
      reason:
        'Bájtszintű összevetés csak méréssel végezhető, ezt a providert nem mértük drótszinten.',
      blockedBy: ['M-09'],
    },
    fineGrainedToolStreaming: {
      state: 'unknown',
      reason:
        'Az API támogatja (tool szintű eager_input_streaming kapcsoló), de hogy a Claude Code first-party úton bekapcsolja-e, nem mértük.',
      blockedBy: ['M-09'],
    },
  },

  serverTools: {
    state: 'known',
    value: [
      {
        wireType: 'web_search_20250305',
        name: 'web_search',
        available: {
          state: 'known',
          value: true,
          evidence: [{ kind: 'doc', url: DOC_WEB_SEARCH }],
        },
      },
    ],
    evidence: [{ kind: 'doc', url: DOC_WEB_SEARCH }],
  },

  models: [
    {
      id: 'claude-opus-5',
      family: 'opus',
      contextWindow: {
        state: 'known',
        value: 1_000_000,
        evidence: [{ kind: 'doc', url: DOC_MODELS }],
      },
      effectiveContextWindowOnWire: {
        state: 'unknown',
        reason: 'Nincs drótszintű mérés ehhez a providerhez.',
        blockedBy: ['M-13'],
      },
      // A dokumentáció egyetlen max output token értéket ad, ajánlott és hard
      // korlátot nem különböztet meg, ezért az ajánlott mező ismeretlen marad.
      maxOutputTokensRecommended: {
        state: 'unknown',
        reason:
          'Az Anthropic dokumentáció nem különböztet meg ajánlott és hard max output tokent, csak egyetlen felső korlátot ad.',
        blockedBy: ['M-13'],
      },
      maxOutputTokensHard: {
        state: 'known',
        value: 128_000,
        evidence: [{ kind: 'doc', url: DOC_MODELS }],
      },
      imageInput: {
        state: 'known',
        value: true,
        evidence: [{ kind: 'doc', url: DOC_VISION }],
      },
      videoInput: {
        state: 'known',
        value: false,
        evidence: [{ kind: 'doc', url: DOC_VISION }],
      },
      listedByModelsEndpoint: {
        state: 'known',
        value: true,
        evidence: [{ kind: 'doc', url: DOC_MODELS_LIST }],
      },
    },
    {
      id: 'claude-sonnet-5',
      family: 'sonnet',
      contextWindow: {
        state: 'known',
        value: 1_000_000,
        evidence: [{ kind: 'doc', url: DOC_MODELS }],
      },
      effectiveContextWindowOnWire: {
        state: 'unknown',
        reason: 'Nincs drótszintű mérés ehhez a providerhez.',
        blockedBy: ['M-13'],
      },
      maxOutputTokensRecommended: {
        state: 'unknown',
        reason:
          'Az Anthropic dokumentáció nem különböztet meg ajánlott és hard max output tokent, csak egyetlen felső korlátot ad.',
        blockedBy: ['M-13'],
      },
      maxOutputTokensHard: {
        state: 'known',
        value: 128_000,
        evidence: [{ kind: 'doc', url: DOC_MODELS }],
      },
      imageInput: {
        state: 'known',
        value: true,
        evidence: [{ kind: 'doc', url: DOC_VISION }],
      },
      videoInput: {
        state: 'known',
        value: false,
        evidence: [{ kind: 'doc', url: DOC_VISION }],
      },
      listedByModelsEndpoint: {
        state: 'known',
        value: true,
        evidence: [{ kind: 'doc', url: DOC_MODELS_LIST }],
      },
    },
    {
      id: 'claude-haiku-4-5',
      family: 'haiku',
      contextWindow: {
        state: 'known',
        value: 200_000,
        evidence: [{ kind: 'doc', url: DOC_MODELS }],
      },
      effectiveContextWindowOnWire: {
        state: 'unknown',
        reason: 'Nincs drótszintű mérés ehhez a providerhez.',
        blockedBy: ['M-13'],
      },
      maxOutputTokensRecommended: {
        state: 'unknown',
        reason:
          'Az Anthropic dokumentáció nem különböztet meg ajánlott és hard max output tokent, csak egyetlen felső korlátot ad.',
        blockedBy: ['M-13'],
      },
      maxOutputTokensHard: {
        state: 'known',
        value: 64_000,
        evidence: [{ kind: 'doc', url: DOC_MODELS }],
      },
      imageInput: {
        state: 'known',
        value: true,
        evidence: [{ kind: 'doc', url: DOC_VISION }],
      },
      videoInput: {
        state: 'known',
        value: false,
        evidence: [{ kind: 'doc', url: DOC_VISION }],
      },
      listedByModelsEndpoint: {
        state: 'known',
        value: true,
        evidence: [{ kind: 'doc', url: DOC_MODELS_LIST }],
      },
    },
  ],

  rateLimits: {
    // Az előfizetéses (Pro/Max) út gördülő 5 órás és heti ablakkal működik,
    // publikus RPM/TPM szám nincs hozzá (https://code.claude.com/docs/en/costs),
    // ezért nincs bucket.
    buckets: [],
    retryAfterHeader: {
      state: 'unknown',
      reason:
        'Az API rate limit dokumentáció retry-after headert ír le, de az előfizetéses út más limit modellt használ (gördülő 5 órás és heti ablak, publikus szám nélkül), és ezt az utat nem mértük.',
      blockedBy: ['M-18'],
    },
    rateLimitHeaders: {
      state: 'unknown',
      reason:
        'Ugyanaz az ok, mint a retryAfterHeader mezőnél: az előfizetéses úton nem mértük, milyen headereket küld a szolgáltatás.',
      blockedBy: ['M-18'],
    },
  },

  anthropicBetaHeaders: {
    state: 'unknown',
    reason: 'Nincs drótszintű mérés ehhez a providerhez.',
    blockedBy: ['M-14'],
  },
} satisfies ProviderCapabilityDescriptor<ClaudeModelId, ClaudeFamilyId>;
