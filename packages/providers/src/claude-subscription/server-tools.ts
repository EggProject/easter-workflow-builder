import type { ServerToolDescriptor } from '../capability/server-tool-descriptor.ts';
import type { Fact } from '@easter-workflow-builder/evidence';
import { DOC_WEB_SEARCH } from '../references/document-url.ts';

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
