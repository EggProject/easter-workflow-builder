import type { ProviderCapabilityDescriptor, Fact } from '@easter-workflow-builder/provider-capability';
import { minimaxConcurrency } from '../limits/concurrency.ts';
import { minimaxDisallowedEnvironment } from '../environment/disallowed-environment.ts';
import { minimaxEffort } from '../request-shaping/effort.ts';
import type { MiniMaxFamilyId } from '../model-catalog/family-id.ts';
import type { MiniMaxModelId } from '../model-catalog/model-id.ts';
import { minimaxModels } from '../model-catalog/models.ts';
import { notMeasuredOnFlash } from '../measurement-gap/not-measured-on-flash.ts';
import { minimaxPromptCaching } from '../request-shaping/prompt-caching.ts';
import { minimaxRateLimits } from '../limits/rate-limits.ts';
import { minimaxRequiredEnvironment } from '../environment/required-environment.ts';
import { minimaxServerTools } from '../tool-support/server-tools.ts';
import { minimaxStreaming } from '../request-shaping/streaming.ts';
import { minimaxStructuredOutput } from '../request-shaping/structured-output.ts';
import { minimaxThinking } from '../request-shaping/thinking.ts';
import { minimaxToolChoice } from '../request-shaping/tool-choice.ts';

// A fő kérés header listáját az előző modellre mérték, a Flash-re nem (SPEC-013 3.2).
const anthropicBetaHeaders: Fact<readonly string[]> = notMeasuredOnFlash(['M-01', 'M-11', 'M-14', 'M-32']);

/**
 * A `minimax` provider képességleírója a `MiniMax-M3.1-Flash` modellre (SPEC-013). Minden
 * `known` mező mögött a Flash-re vonatkozó vagy modelltől független hivatalos dokumentáció áll,
 * bizonyíték az `evidence` mezőben; az előző modellre végzett mérések a Flash-re nem vihetők át,
 * ezért azok mezői `unknown`, a megismétlendő mérés azonosítójával.
 * A mérés részletei a `docs/research` alatt vannak, ide nem kerülnek át.
 */
export const minimaxProvider = {
  id: 'minimax',
  displayName: 'MiniMax',
  sdkVersionPin: '0.3.245',
  // A dátum a dokumentáció ellenőrzéséé, nem drótszintű mérésé (SPEC-013 3.1).
  measuredAt: '2026-10-27',
  requiredEnv: minimaxRequiredEnvironment,
  disallowedEnv: minimaxDisallowedEnvironment,
  structuredOutput: minimaxStructuredOutput,
  toolChoice: minimaxToolChoice,
  thinking: minimaxThinking,
  effort: minimaxEffort,
  promptCaching: minimaxPromptCaching,
  streaming: minimaxStreaming,
  serverTools: minimaxServerTools,
  models: minimaxModels,
  modelsEndpoint: {
    directHttpReachable: notMeasuredOnFlash(['M-35']),
    // A kapcsolat teszt módja ettől nem változik: unknown mellett minimal_query (research 7.).
    calledBySdk: notMeasuredOnFlash(['M-12', 'M-36']),
    listedModelCount: notMeasuredOnFlash(['M-35']),
  },
  rateLimits: minimaxRateLimits,
  concurrency: minimaxConcurrency,
  anthropicBetaHeaders,
} satisfies ProviderCapabilityDescriptor<MiniMaxModelId, MiniMaxFamilyId>;
