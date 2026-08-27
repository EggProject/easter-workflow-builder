import { claudeSubscriptionProvider } from '@easter-workflow-builder/provider-claude-subscription';
import { minimaxProvider } from '@easter-workflow-builder/provider-minimax';

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
