import {
  DOC_7MINAI_MINIMAX_M31_FLASH,
  DOC_CLAUDE_CODE_TOOLS_ALT_PROVIDERS,
  DOC_CLOUDFLARE_MINIMAX_M31_FLASH,
  DOC_DIGITALAPPLIED_MINIMAX_FLASH_CLAUDE_CODE,
  DOC_MINIMAX_ANTHROPIC_API,
  DOC_MINIMAX_CHAT_OPENAI,
  DOC_MINIMAX_CLAUDE_CODE_M_PLAN,
  DOC_MINIMAX_CLAUDE_CODE_TOKEN_PLAN,
  DOC_MINIMAX_TEXT_GENERATION,
  DOC_TYPINGMIND_MINIMAX_M31_FLASH,
  DOC_WOKEY_MINIMAX_M31_FLASH,
  RESEARCH_MINIMAX_FLASH,
  type ModelDescriptor,
} from '@easter-workflow-builder/provider-capability';
import { notMeasuredOnFlash } from '../measurement-gap/not-measured-on-flash.ts';
import type { MiniMaxFamilyId } from './family-id.ts';
import type { MiniMaxModelId } from './model-id.ts';

export const minimaxModels: readonly ModelDescriptor<MiniMaxModelId, MiniMaxFamilyId>[] = [
  {
    id: 'MiniMax-M3.1-Flash',
    family: 'M3.1-Flash',
    // A Claude Code kliensnek a suffixes alakot kell átadni: a MiniMax Claude Code lapjai és két független megerősítés szerint.
    clientModelIdentifier: {
      state: 'known',
      value: 'MiniMax-M3.1-Flash[1m]',
      evidence: [
        { kind: 'doc', url: DOC_MINIMAX_CLAUDE_CODE_M_PLAN },
        { kind: 'doc', url: DOC_MINIMAX_CLAUDE_CODE_TOKEN_PLAN },
        { kind: 'doc', url: DOC_CLAUDE_CODE_TOOLS_ALT_PROVIDERS },
        { kind: 'doc', url: DOC_DIGITALAPPLIED_MINIMAX_FLASH_CLAUDE_CODE },
        { kind: 'research', section: RESEARCH_MINIMAX_FLASH },
      ],
    },
    contextWindow: {
      state: 'known',
      value: 1_000_000,
      evidence: [
        { kind: 'doc', url: DOC_MINIMAX_ANTHROPIC_API },
        { kind: 'doc', url: DOC_MINIMAX_TEXT_GENERATION },
        { kind: 'doc', url: DOC_CLOUDFLARE_MINIMAX_M31_FLASH },
        { kind: 'doc', url: DOC_TYPINGMIND_MINIMAX_M31_FLASH },
      ],
    },
    effectiveContextWindowOnWire: notMeasuredOnFlash(['M-20']),
    maxOutputTokensRecommended: {
      state: 'known',
      value: 131_072,
      evidence: [
        { kind: 'doc', url: DOC_MINIMAX_CHAT_OPENAI },
        { kind: 'doc', url: DOC_7MINAI_MINIMAX_M31_FLASH },
        { kind: 'doc', url: DOC_WOKEY_MINIMAX_M31_FLASH },
      ],
    },
    maxOutputTokensHard: {
      state: 'known',
      value: 524_288,
      evidence: [
        { kind: 'doc', url: DOC_MINIMAX_CHAT_OPENAI },
        { kind: 'doc', url: DOC_WOKEY_MINIMAX_M31_FLASH },
        { kind: 'doc', url: DOC_TYPINGMIND_MINIMAX_M31_FLASH },
      ],
    },
    maxOutputTokensWireCeiling: notMeasuredOnFlash(['M-22']),
    // A dokumentáció támogatottnak írja, az előző modellre végzett mérés az ellenkezőjét adta.
    imageInput: notMeasuredOnFlash(['M-23', 'M-16']),
    videoInput: {
      state: 'unknown',
      reason: 'A blokkoló a telepített SDK típusfelülete: a ContentBlockParam unió nem tartalmaz videó variánst.',
      blockedBy: ['M-16', 'M-23'],
    },
    listedByModelsEndpoint: notMeasuredOnFlash(['M-35']),
  },
];
