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

/**
 * A Claude Code env változó referencia. Innen származik a max_tokens vágás szabálya:
 * "Claude Code defaults to 32000 for model IDs it doesn't recognize, such as
 * gateway-specific names, and lowers values above a model's cap to the cap."
 */
const DOC_ENV_VARS = 'https://code.claude.com/docs/en/env-vars';

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
        'Levágja a session cím generáló háttérkérést. Ezzel felezi a kérésszámot (rate limit) és megszünteti az egyetlen olyan kérést, ami natív output_config.format mezőt küld. Ráadásul a DesignSync toolt is leveszi a tools tömbből (25 -> 24 elem, mért 2317 input token megtakarítás kérésenként), amit a célzottabb CLAUDE_CODE_DISABLE_TERMINAL_TITLE nem tesz meg.',
      evidence: [
        { kind: 'measurement', id: 'M-07' },
        { kind: 'measurement', id: 'M-08' },
        { kind: 'measurement', id: 'M-21' },
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
        // M-19: a prompt nem említette az emit_output toolt, ezért a Stop hook
        // blokkoló ága ténylegesen aktiválódott. 10/10 futás sikeres, mindegyikben
        // pontosan 1 blokkolás után hívta meg a modell a toolt.
        usable: {
          state: 'known',
          value: true,
          evidence: [
            { kind: 'measurement', id: 'M-19' },
            { kind: 'measurement', id: 'M-10' },
          ],
        },
        // A hook reason szövege "Stop hook feedback:" előtaggal, role:"user"
        // üzenetként megy ki (M-19 run-1, 3. kérés), nem role:"system"-ként,
        // tehát a MiniMax system role kockázata ezen az úton fel sem merül.
        blockingWireDetail: {
          state: 'known',
          value: null,
          evidence: [{ kind: 'measurement', id: 'M-19' }],
        },
        // num_turns: 3 a blokkolással, szemben az M-10 kikényszerítés nélküli 2 körével.
        observedRoundTrips: {
          state: 'known',
          value: [3],
          evidence: [{ kind: 'measurement', id: 'M-19' }],
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
    // Mindkét stratégia bizonyítottan használható. Az alapértelmezés azért marad
    // az sdk_output_format, mert nem igényel Stop hookot, a séma validációt az SDK
    // végzi, és nem kell hozzá plusz modellkör a blokkoláshoz (M-03: 4 kör tool
    // hívással, M-19: 3 kör, amiből 1 kizárólag a hook blokkolása miatt kellett).
    defaultStrategy: {
      state: 'known',
      value: 'sdk_output_format',
      evidence: [
        { kind: 'measurement', id: 'M-02' },
        { kind: 'measurement', id: 'M-03' },
        { kind: 'measurement', id: 'M-19' },
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
    // A cache írás ténye az M-20 bináris keresésből igazolt: a 8. probe
    // cache_read_input_tokens értéke 985344, ami csak úgy állhatott elő, hogy az
    // előző, majdnem azonos prefixű probe beírta a cache-t. Az implicit mód is
    // igazolt: az M-15 (c) futásban nulla cache_control blokk mellett is
    // cache_read_input_tokens: 128 jött vissza. Ami NEM eldönthető: hogy az
    // explicit cache_control breakpointoknak van-e önálló hatásuk, mert a
    // cache_read érték 3 és 0 blokk mellett egyaránt 128 volt, és a szolgáltatás
    // sosem jelent cache_creation_input_tokens mezőt.
    mode: {
      state: 'unknown',
      reason:
        'Az implicit cache olvasás igazolt (M-15 c: nulla cache_control blokk mellett is cache_read_input_tokens: 128), a cache írás ténye is igazolt (M-20 8. probe: 985344 cache_read token), de az explicit cache_control breakpointok önálló hatása nem mérhető: a cache_read érték 3 és 0 breakpoint mellett azonos, a válasz pedig sosem hordoz cache_creation_input_tokens mezőt. Az implicit és az implicit_and_explicit érték között ezen az úton nem lehet dönteni.',
      blockedBy: ['M-15', 'M-20', 'M-24'],
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
    // Kizárólag a ténylegesen megfigyelt mezőnév. Az M-24 külön ellenőrizte a
    // message_start.message.usage és a message_delta.usage objektumot is:
    // cache_creation_input_tokens egyikben sem szerepel.
    usageFields: {
      state: 'known',
      value: ['cache_read_input_tokens'],
      evidence: [
        { kind: 'measurement', id: 'M-15' },
        { kind: 'measurement', id: 'M-24' },
      ],
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
    // M-24: a telepített SDK Options típusában nincs stream mező (az
    // includePartialMessages csak a kliens oldali SDKMessage kiadást szabályozza),
    // és a kimenő body stream mezője mind a 4 mért kérésben true.
    streamDisableable: {
      state: 'known',
      value: false,
      evidence: [{ kind: 'measurement', id: 'M-24' }],
    },
  },

  // M-17: a web_search tool kimegy a dróton, HTTP 200 jön vissza, de a válasz nem
  // tartalmaz server_tool_use vagy web_search_tool_result blokkot. A MiniMax
  // csendben eldobja, a modell keresés nélkül válaszol. M-25 kizárta, hogy ezt a
  // maxTurns limit okozta volna: maxTurns 12 mellett a futás result subtype-ja
  // success, és a 7 kérés egyikének stream válaszában sincs eredményblokk.
  serverTools: {
    state: 'known',
    value: [
      {
        wireType: 'web_search_20250305',
        name: 'web_search',
        available: {
          state: 'known',
          value: false,
          evidence: [
            { kind: 'measurement', id: 'M-17' },
            { kind: 'measurement', id: 'M-25' },
          ],
        },
      },
    ],
    evidence: [
      { kind: 'measurement', id: 'M-17' },
      { kind: 'measurement', id: 'M-25' },
    ],
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
      // MÉRT ALSÓ KORLÁT, nem a pontos határ. M-20 8. probe: a sikeres kérés
      // usage.input_tokens 61483 + cache_read_input_tokens 985344 = 1046827 token,
      // HTTP 200. A következő lépcső (2 700 000 karakter, a mért 2,46 kar/token
      // arányból kb. 1,10M token) már "400 invalid params, context window exceeds
      // limit (2013)" hibát adott, tehát a valódi határ 1046827 és kb. 1,10M között
      // van. FONTOS: ez MiniMax-M3[1m] modellazonosítóval mért érték, tehát a
      // context-1m-2025-08-07 beta header jelenlétében.
      effectiveContextWindowOnWire: {
        state: 'known',
        value: 1_046_827,
        evidence: [{ kind: 'measurement', id: 'M-20' }],
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
      // M-22: a CLAUDE_CODE_MAX_OUTPUT_TOKENS 4096 és 32000 értéke változatlanul
      // ment ki, a 131072 és az 524288 viszont egyaránt 128000-re vágódott. A
      // fenti két dokumentált MiniMax korlát tehát az SDK-n keresztül nem érhető el.
      maxOutputTokensWireCeiling: {
        state: 'known',
        value: 128_000,
        evidence: [
          { kind: 'measurement', id: 'M-22' },
          { kind: 'doc', url: DOC_ENV_VARS },
        ],
      },
      // M-23: a harness egy érvényes, 256x256 pixeles, tiszta piros (255,0,0) PNG-t
      // küldött. A kimenő body messages[0].content[2] eleme ténylegesen
      // {"type":"image","source":{"type":"base64","media_type":"image/png",...}} volt,
      // 1136 karakteres base64 adattal, tehát az SDK KIKÜLDTE a képet. A válasz
      // HTTP 200, a modell szövege mégis "Nincs kép." A képet a szolgáltatás dobja el,
      // nem az SDK, és nem a tesztkép mérete okozta az M-16 eredményt.
      imageInput: {
        state: 'known',
        value: false,
        evidence: [
          { kind: 'measurement', id: 'M-23' },
          { kind: 'measurement', id: 'M-16' },
        ],
      },
      videoInput: {
        state: 'unknown',
        reason:
          'Az SDK-ból nem állítottunk elő videó content blokkot, a research modelltáblázata pedig összevont kép és videó oszlopot használ. Az M-23 csak a kép content blokkra ad bizonyítékot, videóra nem.',
        blockedBy: ['M-16', 'M-23'],
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
