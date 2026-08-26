import type { ModelDescriptor } from '../capability/model-descriptor.ts';
import { DOC_ENV_VARS, DOC_MODEL_CONFIG } from '../references/document-url.ts';
import { RESEARCH_MINIMAX } from '../references/research-section.ts';
import type { MiniMaxFamilyId } from './family-id.ts';
import type { MiniMaxModelId } from './model-id.ts';

export const minimaxModels: readonly ModelDescriptor<MiniMaxModelId, MiniMaxFamilyId>[] = [
  {
    id: 'MiniMax-M3',
    family: 'M3',
    // A dróton a modell azonosító suffix nélküli, a kliensnek viszont a suffixes alakot kell átadni.
    clientModelIdentifier: {
      state: 'known',
      value: 'MiniMax-M3[1m]',
      evidence: [
        { kind: 'measurement', id: 'M-11' },
        { kind: 'measurement', id: 'M-29' },
        { kind: 'measurement', id: 'M-32' },
        { kind: 'doc', url: DOC_MODEL_CONFIG },
      ],
    },
    contextWindow: {
      state: 'known',
      value: 1_000_000,
      evidence: [{ kind: 'research', section: RESEARCH_MINIMAX }],
    },
    // Mért alsó korlát, nem a pontos határ, [1m] suffixes modellazonosítóval mérve.
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
    // A kliens a nagyobb kért értékeket a saját modelltáblájának plafonjára vágja.
    maxOutputTokensWireCeiling: {
      state: 'known',
      value: 128_000,
      evidence: [
        { kind: 'measurement', id: 'M-22' },
        { kind: 'doc', url: DOC_ENV_VARS },
      ],
    },
    // A kép kimegy a dróton, a szolgáltatás dobja el, nem az SDK vagy a kliens.
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
      reason: 'A blokkoló a telepített SDK típusfelülete: a ContentBlockParam unió nem tartalmaz videó variánst.',
      blockedBy: ['M-16', 'M-23'],
    },
    // A modell szerepel a szolgáltatás saját modell-listájában.
    listedByModelsEndpoint: {
      state: 'known',
      value: true,
      evidence: [{ kind: 'measurement', id: 'M-35' }],
    },
  },
];
