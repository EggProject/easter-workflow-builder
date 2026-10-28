import type { ToolChoiceCapability } from '@easter-workflow-builder/provider-capability';

export const minimaxToolChoice: ToolChoiceCapability = {
  accepted: {
    state: 'unknown',
    reason:
      'Egyetlen közvetlen hívásból a kényszerített any érték betartása nem választható el a modell saját döntésétől, a none érték nem mért.',
    blockedBy: ['M-34'],
  },
  // A tool típusú kényszerítést a Flash 200 válasszal, tool_use blokk nélkül csendben eldobja.
  rejectionBehaviour: {
    state: 'known',
    value: 'silently_dropped',
    evidence: [{ kind: 'measurement', id: 'M-34-flash' }],
  },
  // A kimenő kérések tool_choice mezője hiányzik vagy auto, kényszerített választás nincs.
  sdkSendsForcedChoice: {
    state: 'known',
    value: false,
    evidence: [
      { kind: 'measurement', id: 'M-03-flash' },
      { kind: 'measurement', id: 'M-17-flash' },
    ],
  },
};
