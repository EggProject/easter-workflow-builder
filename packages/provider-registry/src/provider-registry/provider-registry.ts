import type { ProviderId } from '@easter-workflow-builder/provider-capability';
import { claudeSubscriptionProvider } from '@easter-workflow-builder/provider-claude-subscription';
import { minimaxProvider } from '@easter-workflow-builder/provider-minimax';

/**
A két provider leíró típusa, providerenként eltérő modell- és családazonosítóval. A
`Readonly<Record<ProviderId, unknown>>` kiterjesztés kényszeríti ki, hogy a kulcsok pontosan a
`ProviderId` unióból jöjjenek: ha az unió egy taggal bővül, ez az interfész a hozzá tartozó
mező nélkül nem fordul le (SPEC-003 T-003-6).
*/
export interface ProviderRegistry extends Readonly<Record<ProviderId, unknown>> {
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
