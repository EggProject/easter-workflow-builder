/**
 * A `minimax` provider képességleírója.
 *
 * Minden `known` mező mögött vagy egy SPEC-000 mérési eset áll (`docs/measurements`
 * helyett jelenleg `tools/wire-probe/artifacts/`), vagy a research fájl megerősített
 * ténye, vagy hivatalos dokumentáció. Ahol a mérés nem döntött, a mező `unknown`.
 *
 * Kiértékelés: `docs/research/2026-08-26-spec000-kiertekeles.md`.
 * Nyers megfigyelések: `docs/research/2026-08-26-spec000-meresi-jegyzokonyv.md`.
 */
import type { ProviderCapabilityDescriptor } from './capability-descriptor.ts';

/** A projekt hatókörében kizárólag ez az egy MiniMax modell van. */
export type MiniMaxModelId = 'MiniMax-M3';

/** Modellcsalád, jelenleg egyetlen elem. */
export type MiniMaxFamilyId = 'M3';

const RESEARCH_MINIMAX = '2026-08-26-agent-sdk-minimax.md 2. szekció, MiniMax endpoint';
const RESEARCH_GATEWAY = '2026-08-26-agent-sdk-minimax.md 3. szekció, nem-Anthropic endpoint';

export const minimaxProvider = {
  id: 'minimax',
  displayName: 'MiniMax',
  sdkVersionPin: '0.3.245',
  measuredAt: '2026-08-26',

  requiredEnv: [
    {
      name: 'ANTHROPIC_BASE_URL',
      source: 'literal',
      literalValue: 'https://api.minimax.io/anthropic',
      secret: false,
      purpose: 'A nemzetközi MiniMax Anthropic-kompatibilis endpoint.',
      evidence: [{ kind: 'research', section: RESEARCH_MINIMAX }],
    },
    {
      name: 'ANTHROPIC_AUTH_TOKEN',
      source: 'process_env_passthrough',
      secret: true,
      purpose:
        'A MINIMAX_API_KEY process env változó értéke megy Bearer tokenként. Az adatbázis csak a NEVET tárolja.',
      evidence: [
        { kind: 'research', section: RESEARCH_MINIMAX },
        { kind: 'research', section: RESEARCH_GATEWAY },
      ],
    },
    {
      name: 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC',
      source: 'literal',
      literalValue: '1',
      secret: false,
      purpose:
        'Levágja a session cím generáló háttérkérést. Ezzel felezi a kérésszámot (rate limit) és megszünteti az egyetlen olyan kérést, ami natív output_config.format mezőt küld.',
      evidence: [
        { kind: 'measurement', id: 'M-07' },
        { kind: 'measurement', id: 'M-08' },
      ],
    },
  ],

  disallowedEnv: [
    {
      name: 'CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING',
      reason:
        'Custom base URL mellett kerülendő: beta tool séma mezőket kényszerít ki, amiket a MiniMax nem ismer.',
      evidence: [{ kind: 'research', section: RESEARCH_GATEWAY }],
    },
    {
      name: 'CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING',
      reason:
        'Fix budget alakú thinking mezőt kényszerít ki, a MiniMax sémája viszont csak disabled és adaptive értéket ismer, budget_tokens kulcs nélkül.',
      evidence: [
        { kind: 'research', section: RESEARCH_GATEWAY },
        { kind: 'research', section: RESEARCH_MINIMAX },
      ],
    },
    {
      name: 'MAX_THINKING_TOKENS',
      reason:
        'A 0 érték leveszi a thinking és context_management body mezőket, de a hozzájuk tartozó anthropic-beta headereket a headerben hagyja (fél pár), ráadásul kikapcsolja az M3 adaptív thinkingjét.',
      evidence: [
        { kind: 'measurement', id: 'M-06' },
        { kind: 'measurement', id: 'M-08' },
      ],
    },
  ],

  structuredOutput: {
    strategies: [
      {
        id: 'emit_output_tool',
        // A blokkoló ág sosem futott le: az M-10 promptja maga kérte a tool hívását,
        // ezért csak a happy path bizonyított, a kikényszerítés nem.
        usable: {
          state: 'unknown',
          reason:
            'Az M-10 mindhárom futása sikeres, de a Stop hook decision:"block" ága egyszer sem aktiválódott, mert a prompt maga kérte az emit_output hívását. A kikényszerítő mechanizmus bizonyítatlan.',
          blockedBy: ['M-10'],
        },
        blockingWireDetail: {
          state: 'unknown',
          reason:
            'Blokkoló drótrészlet nem azonosítható, amíg a blokkoló ág nem fut le. Annyi mérésből tudható, hogy a mid-conversation role:"system" üzenet MiniMax M3 ellen HTTP 200-at kap.',
          blockedBy: ['M-10'],
        },
        observedRoundTrips: {
          state: 'unknown',
          reason:
            'Az M-10 futásainak 2 köre a happy pathhoz kellett, nem a kikényszerítéshez. Kikényszerített körszám nincs megfigyelve.',
          blockedBy: ['M-10'],
        },
      },
      {
        id: 'sdk_output_format',
        usable: {
          state: 'known',
          value: true,
          evidence: [
            { kind: 'measurement', id: 'M-02' },
            { kind: 'measurement', id: 'M-03' },
          ],
        },
        blockingWireDetail: {
          state: 'known',
          value: null,
          evidence: [{ kind: 'measurement', id: 'M-03' }],
        },
        // M-03: result subtype success, num_turns 4, kitöltött structured_output mezővel.
        observedRoundTrips: {
          state: 'known',
          value: [4],
          evidence: [{ kind: 'measurement', id: 'M-03' }],
        },
      },
    ],
    defaultStrategy: {
      state: 'known',
      value: 'sdk_output_format',
      evidence: [
        { kind: 'measurement', id: 'M-02' },
        { kind: 'measurement', id: 'M-03' },
        { kind: 'measurement', id: 'M-10' },
      ],
    },
    // 79 POST /v1/messages kérésből 79 hordozott output_config-ot, effort és
    // outputFormat beállítás nélkül is.
    outputConfigAlwaysSent: {
      state: 'known',
      value: true,
      evidence: [
        { kind: 'measurement', id: 'M-01' },
        { kind: 'measurement', id: 'M-04' },
      ],
    },
    outputConfigWireField: {
      state: 'known',
      value: 'output_config.effort',
      evidence: [
        { kind: 'measurement', id: 'M-01' },
        { kind: 'measurement', id: 'M-04' },
      ],
    },
  },

  toolChoice: {
    accepted: {
      state: 'known',
      value: ['auto', 'none'],
      evidence: [{ kind: 'research', section: RESEARCH_MINIMAX }],
    },
    rejectionBehaviour: {
      state: 'unknown',
      reason:
        'Az SDK a teljes mérés alatt egyetlen nem támogatott tool_choice értéket sem küldött, ezért a provider elutasítási viselkedése nem derült ki.',
      blockedBy: ['M-03'],
    },
    // 79 kérésből 4 hordozott tool_choice mezőt, mind {"type":"auto"}, mind a
    // WebSearch tool belső alkéréseiben. any és tool típus nem fordult elő.
    sdkSendsForcedChoice: {
      state: 'known',
      value: false,
      evidence: [
        { kind: 'measurement', id: 'M-03' },
        { kind: 'measurement', id: 'M-17' },
      ],
    },
  },

  thinking: {
    byModelFamily: {
      M3: {
        state: 'known',
        value: ['disabled', 'adaptive'],
        evidence: [
          { kind: 'research', section: RESEARCH_MINIMAX },
          { kind: 'measurement', id: 'M-05' },
          { kind: 'measurement', id: 'M-06' },
        ],
      },
    },
    wireShape: {
      state: 'known',
      value: '{"type":"adaptive"}',
      evidence: [
        { kind: 'measurement', id: 'M-01' },
        { kind: 'measurement', id: 'M-05' },
      ],
    },
    sendsBudgetTokens: {
      state: 'known',
      value: false,
      evidence: [
        { kind: 'measurement', id: 'M-05' },
        { kind: 'measurement', id: 'M-06' },
      ],
    },
    interleavedSignatureRequired: {
      state: 'known',
      value: true,
      evidence: [
        { kind: 'research', section: RESEARCH_MINIMAX },
        { kind: 'measurement', id: 'M-05' },
      ],
    },
    streamEventTypes: {
      state: 'known',
      value: ['content_block_start', 'thinking_delta', 'signature_delta', 'content_block_stop'],
      evidence: [{ kind: 'measurement', id: 'M-05' }],
    },
  },

  effort: {
    // M-04: effort low és max mellett is HTTP 200, nincs 400.
    accepted: {
      state: 'known',
      value: true,
      evidence: [{ kind: 'measurement', id: 'M-04' }],
    },
    wireField: {
      state: 'known',
      value: 'output_config.effort',
      evidence: [{ kind: 'measurement', id: 'M-04' }],
    },
  },

  promptCaching: {
    // A cache_control blokkok kimennek és HTTP 200-at kapnak, de a cache írás
    // nem igazolt: cache_creation_input_tokens egyetlen stream eventben sem jelent meg.
    mode: {
      state: 'unknown',
      reason:
        'M3-on az explicit cache_control blokkok kimennek és a provider elfogadja őket, de a válaszban csak cache_read_input_tokens figyelhető meg, cache_creation_input_tokens nem, ezért a cache írás nem igazolt. Nem stream válasz usage objektumának rögzítése kell hozzá.',
      blockedBy: ['M-15'],
    },
    explicitBreakpointLimit: {
      state: 'known',
      value: 4,
      evidence: [{ kind: 'research', section: RESEARCH_MINIMAX }],
    },
    ttlSeconds: {
      state: 'known',
      value: 300,
      evidence: [{ kind: 'research', section: RESEARCH_MINIMAX }],
    },
    minimumInputTokens: {
      state: 'known',
      value: 512,
      evidence: [{ kind: 'research', section: RESEARCH_MINIMAX }],
    },
    // Kizárólag a ténylegesen megfigyelt mezőnév. A cache_creation_input_tokens
    // dokumentált, de a mérésben a dróton nem jelent meg, lásd a mode mezőt.
    usageFields: {
      state: 'known',
      value: ['cache_read_input_tokens'],
      evidence: [{ kind: 'measurement', id: 'M-15' }],
    },
    disableEnvVar: {
      state: 'known',
      value: 'DISABLE_PROMPT_CACHING',
      evidence: [
        { kind: 'measurement', id: 'M-08' },
        { kind: 'measurement', id: 'M-15' },
      ],
    },
  },

  streaming: {
    sse: {
      state: 'known',
      value: true,
      evidence: [
        { kind: 'measurement', id: 'M-05' },
        { kind: 'measurement', id: 'M-09' },
      ],
    },
    toolInputDelta: {
      state: 'known',
      value: 'input_json_delta',
      evidence: [{ kind: 'measurement', id: 'M-09' }],
    },
    // Bájtszintű egyezés a tool callback inputja és az assistant tool_use blokk között.
    sdkReassemblesToolInput: {
      state: 'known',
      value: true,
      evidence: [{ kind: 'measurement', id: 'M-09' }],
    },
    // A kimenő anthropic-beta header egyetlen kérésben sem tartalmaz
    // fine-grained tool streaming elemet.
    fineGrainedToolStreaming: {
      state: 'known',
      value: false,
      evidence: [
        { kind: 'research', section: RESEARCH_GATEWAY },
        { kind: 'measurement', id: 'M-14' },
      ],
    },
  },

  // M-17: a web_search tool kimegy a dróton, HTTP 200 jön vissza, de a válasz nem
  // tartalmaz server_tool_use vagy web_search_tool_result blokkot. A MiniMax
  // csendben eldobja, a modell keresés nélkül válaszol.
  serverTools: {
    state: 'known',
    value: [
      {
        wireType: 'web_search_20250305',
        name: 'web_search',
        available: {
          state: 'known',
          value: false,
          evidence: [{ kind: 'measurement', id: 'M-17' }],
        },
      },
    ],
    evidence: [{ kind: 'measurement', id: 'M-17' }],
  },

  models: [
    {
      id: 'MiniMax-M3',
      family: 'M3',
      contextWindow: {
        state: 'known',
        value: 1_000_000,
        evidence: [{ kind: 'research', section: RESEARCH_MINIMAX }],
      },
      // A kliens oldal 200000-rel tervez, de az endpoint tényleges határa nem mért:
      // M-13 nem érte el sem a compact boundaryt, sem a 413 request_too_large hibát.
      effectiveContextWindowOnWire: {
        state: 'unknown',
        reason:
          'M-13 mindössze 3 kérés után lezárult, compact boundary és 413 request_too_large nem fordult elő, count_tokens kérés egyszer sem ment ki. A kliens oldali modelUsage.contextWindow 200000, de ez helyi feltételezés, nem az endpoint jelentése.',
        blockedBy: ['M-13'],
      },
      maxOutputTokensRecommended: {
        state: 'known',
        value: 131_072,
        evidence: [{ kind: 'research', section: RESEARCH_MINIMAX }],
      },
      maxOutputTokensHard: {
        state: 'known',
        value: 524_288,
        evidence: [{ kind: 'research', section: RESEARCH_MINIMAX }],
      },
      imageInput: {
        state: 'unknown',
        reason:
          'M-16 egy 1x1 pixeles PNG-vel futott. A kérés HTTP 200-at kapott és a kép base64 tartalma kiment a dróton, de a modell "Nem látok képet a beszélgetésben." választ adott. Ebből nem dönthető el, hogy a provider eldobta a képet, vagy a modell egy egypixeles képről nem tud mit mondani.',
        blockedBy: ['M-16'],
      },
      videoInput: {
        state: 'unknown',
        reason:
          'Az SDK-ból nem állítottunk elő videó content blokkot, a research modelltáblázata pedig összevont kép és videó oszlopot használ.',
        blockedBy: ['M-16'],
      },
      listedByModelsEndpoint: {
        state: 'unknown',
        reason:
          'A teljes mérés 113 tranzakciójában egyetlen GET /v1/models kérés sem ment ki, tehát az endpoint modell-listája ismeretlen. A supportedModels() visszatérése helyi Claude Code konfiguráció, nem drótadat.',
        blockedBy: ['M-12'],
      },
    },
  ],

  rateLimits: {
    buckets: [
      {
        appliesTo: ['MiniMax-M3'],
        requestsPerMinute: {
          state: 'known',
          value: 200,
          evidence: [{ kind: 'research', section: RESEARCH_MINIMAX }],
        },
        tokensPerMinute: {
          state: 'known',
          value: 10_000_000,
          evidence: [{ kind: 'research', section: RESEARCH_MINIMAX }],
        },
      },
    ],
    retryAfterHeader: {
      state: 'unknown',
      reason:
        'A mérés alatt egyetlen 429-es válasz sem keletkezett, retry-after alstringet tartalmazó header egyetlen tranzakcióban sem fordult elő. Szándékos rate limit kimerítést nem végzünk.',
      blockedBy: ['M-18'],
    },
    rateLimitHeaders: {
      state: 'unknown',
      reason:
        'A 113 tranzakció válasz headereinek uniójában nincs ratelimit alstringet tartalmazó elem, de 429 sem keletkezett, ezért a hiány nem bizonyíték.',
      blockedBy: ['M-18'],
    },
  },

  // A fő kérés header listája. A session cím generáló kérés ezen felül a
  // structured-outputs-2025-12-15 elemet is küldi, de azt a kötelező
  // CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 levágja.
  anthropicBetaHeaders: {
    state: 'known',
    value: [
      'claude-code-20250219',
      'interleaved-thinking-2025-05-14',
      'thinking-token-count-2026-05-13',
      'context-management-2025-06-27',
      'prompt-caching-scope-2026-01-05',
      'mid-conversation-system-2026-04-07',
      'effort-2025-11-24',
    ],
    evidence: [
      { kind: 'measurement', id: 'M-01' },
      { kind: 'measurement', id: 'M-14' },
    ],
  },
} satisfies ProviderCapabilityDescriptor<MiniMaxModelId, MiniMaxFamilyId>;
