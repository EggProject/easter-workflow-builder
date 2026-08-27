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
    },
  ],
  evidence: [{ kind: 'doc', url: DOC_WEB_SEARCH }],
};
