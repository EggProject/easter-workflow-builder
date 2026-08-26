import type { ModelDescriptor } from '../capability/model-descriptor.ts';
import type { Fact } from '../evidence/fact.ts';
import { DOC_MODEL_CONFIG, DOC_MODELS, DOC_MODELS_LIST, DOC_VISION } from '../references/document-url.ts';
import type { ClaudeFamilyId } from './family-id.ts';
import type { ClaudeModelId } from './model-id.ts';

// A három modell azonos ismeretlen mezőit egy konstans hordozza, típusannotációval, `as` nélkül.
const maxOutputTokensRecommendedUnknown: Fact<number> = {
  state: 'unknown',
  reason:
    'Az Anthropic dokumentáció nem különböztet meg ajánlott és hard max output tokent, csak egyetlen felső korlátot ad.',
  blockedBy: ['M-13'],
};

const maxOutputTokensWireCeilingUnknown: Fact<number> = {
  state: 'unknown',
  reason:
    'A Claude Code dokumentáltan a modell cap értékére vágja, de first-party úton a kimenő max_tokens értékét nem mértük.',
  blockedBy: ['M-22'],
};

const effectiveContextWindowOnWireUnknown: Fact<number> = {
  state: 'unknown',
  reason: 'Nincs drótszintű mérés ehhez a providerhez.',
  blockedBy: ['M-13'],
};

export const claudeSubscriptionModels: readonly ModelDescriptor<ClaudeModelId, ClaudeFamilyId>[] = [
  {
    id: 'claude-opus-5',
    family: 'opus',
    // Az Opus tényleges kontextusablaka az előfizetés szintjétől függ, ezért a klienshez átadandó azonosító alak nem állítható.
    clientModelIdentifier: {
      state: 'unknown',
      reason:
        'Az Opus 1M ablaka előfizetés függő, ezért a suffixes és suffix nélküli azonosító közötti választás fiók nélkül nem dönthető el.',
      blockedBy: ['M-11'],
    },
    contextWindow: {
      state: 'known',
      value: 1_000_000,
      evidence: [{ kind: 'doc', url: DOC_MODELS }],
    },
    effectiveContextWindowOnWire: effectiveContextWindowOnWireUnknown,
    maxOutputTokensRecommended: maxOutputTokensRecommendedUnknown,
    maxOutputTokensHard: {
      state: 'known',
      value: 128_000,
      evidence: [{ kind: 'doc', url: DOC_MODELS }],
    },
    maxOutputTokensWireCeiling: maxOutputTokensWireCeilingUnknown,
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
    // A Sonnet 5 mindig 1M ablakkal fut, nincs [1m] suffixe, a kliensnek a puszta azonosító megy.
    clientModelIdentifier: {
      state: 'known',
      value: 'claude-sonnet-5',
      evidence: [{ kind: 'doc', url: DOC_MODEL_CONFIG }],
    },
    contextWindow: {
      state: 'known',
      value: 1_000_000,
      evidence: [{ kind: 'doc', url: DOC_MODELS }],
    },
    effectiveContextWindowOnWire: effectiveContextWindowOnWireUnknown,
    maxOutputTokensRecommended: maxOutputTokensRecommendedUnknown,
    maxOutputTokensHard: {
      state: 'known',
      value: 128_000,
      evidence: [{ kind: 'doc', url: DOC_MODELS }],
    },
    maxOutputTokensWireCeiling: maxOutputTokensWireCeilingUnknown,
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
    // A Haiku 4.5 ablaka 200 000 token, 1M variánsa nincs, a kliensnek a puszta azonosító megy.
    clientModelIdentifier: {
      state: 'known',
      value: 'claude-haiku-4-5',
      evidence: [
        { kind: 'doc', url: DOC_MODELS },
        { kind: 'doc', url: DOC_MODEL_CONFIG },
      ],
    },
    contextWindow: {
      state: 'known',
      value: 200_000,
      evidence: [{ kind: 'doc', url: DOC_MODELS }],
    },
    effectiveContextWindowOnWire: effectiveContextWindowOnWireUnknown,
    maxOutputTokensRecommended: maxOutputTokensRecommendedUnknown,
    maxOutputTokensHard: {
      state: 'known',
      value: 64_000,
      evidence: [{ kind: 'doc', url: DOC_MODELS }],
    },
    maxOutputTokensWireCeiling: maxOutputTokensWireCeilingUnknown,
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
];
