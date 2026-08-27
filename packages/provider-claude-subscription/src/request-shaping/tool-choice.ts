import { DOC_TOOL_USE, type ToolChoiceCapability } from '@easter-workflow-builder/provider-capability';

export const claudeSubscriptionToolChoice: ToolChoiceCapability = {
  accepted: {
    state: 'known',
    value: ['auto', 'none', 'any', 'tool'],
    evidence: [{ kind: 'doc', url: DOC_TOOL_USE }],
  },
  rejectionBehaviour: {
    state: 'unknown',
    reason: 'Mind a négy érték támogatott, ezért nincs olyan bemenet, amivel az elutasítási viselkedés kiderülne.',
    blockedBy: ['M-03'],
  },
  sdkSendsForcedChoice: {
    state: 'unknown',
    reason: 'Nincs drótszintű mérés ehhez a providerhez.',
    blockedBy: ['M-03'],
  },
};
