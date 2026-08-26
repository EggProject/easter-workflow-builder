import { claudeSubscriptionProvider } from './claude-subscription/descriptor.ts';
import { minimaxProvider } from './minimax/descriptor.ts';

/**
A két provider leíró típusa, providerenként eltérő modell- és családazonosítóval.
*/
export interface ProviderRegistry {
  readonly 'claude-subscription': typeof claudeSubscriptionProvider;
  readonly minimax: typeof minimaxProvider;
}

/**
A két provider leíró egyetlen, kulcs szerint elérhető, readonly rekordban.
*/
export const providerRegistry: ProviderRegistry = {
  'claude-subscription': claudeSubscriptionProvider,
  minimax: minimaxProvider,
};
