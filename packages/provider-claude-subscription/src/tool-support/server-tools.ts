import { DOC_WEB_SEARCH, type ServerToolDescriptor, type Fact } from '@easter-workflow-builder/provider-capability';

export const claudeSubscriptionServerTools: Fact<readonly ServerToolDescriptor[]> = {
  state: 'known',
  value: [
    {
      wireType: 'web_search_20250305',
      name: 'web_search',
      available: {
        state: 'known',
        value: true,
        evidence: [{ kind: 'doc', url: DOC_WEB_SEARCH }],
      },
      // A WebSearch -> web_search_20250305 leképezést az M-17 és M-25 mérés a
      // MiniMax base URL-en, proxyzott dróton figyelte meg. Erre a first-party
      // (claude-subscription) útvonalra nem készült drótszintű mérés, és a
      // DOC_WEB_SEARCH doksi a Messages API szerver oldali tool típusáról szól,
      // nem a Claude Code kliens oldali eszköznevéről, ezért nem tippelhető meg.
      clientToolName: {
        state: 'unknown',
        reason:
          'A kliens oldali eszköznév-megfeleltetésre nincs drótszintű mérés ezen a first-party útvonalon; az M-17/M-25 mérés a MiniMax base URL-en proxyzott dróton figyelte meg a WebSearch -> web_search_20250305 leképezést, ami erre az útvonalra nem másolható át, és a DOC_WEB_SEARCH doksi csak a Messages API szerver oldali tool típusát írja le, a Claude Code kliens oldali eszköznevet nem.',
        blockedBy: ['M-17', 'M-25'],
      },
    },
  ],
  evidence: [{ kind: 'doc', url: DOC_WEB_SEARCH }],
};
