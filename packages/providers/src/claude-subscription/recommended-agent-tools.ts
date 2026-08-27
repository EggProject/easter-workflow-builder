import type { AgentToolRecommendation } from '@easter-workflow-builder/provider-capability';
import type { Fact } from '@easter-workflow-builder/evidence';

/**
 * Ehhez a providerhez nincs drótszintű mérésünk, tehát nincs bizonyíték arra,
 * hogy bármelyik saját folyamatban futó eszköz jobb lenne a beépített
 * megfelelőjénél. Tippelni tilos, ezért a mező ismeretlen marad.
 */
export const claudeSubscriptionRecommendedAgentTools: Fact<readonly AgentToolRecommendation[]> = {
  state: 'unknown',
  reason:
    'Ezt a providert nem mértük drótszinten, ezért nincs bizonyíték arra, hogy a beépített kereső és képbemenet helyett saját eszközt kellene bekapcsolni.',
  blockedBy: ['M-17', 'M-25', 'M-16', 'M-23'],
};
