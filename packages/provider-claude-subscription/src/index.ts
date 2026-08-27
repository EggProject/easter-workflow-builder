// Barrel: csak újraexport, a csomag publikus felülete csak azt adja ki, amire másik csomagnak szüksége van.

export { claudeSubscriptionProvider } from './descriptor/descriptor.ts';
export type { ClaudeModelId } from './model-catalog/model-id.ts';
export type { ClaudeFamilyId } from './model-catalog/family-id.ts';
