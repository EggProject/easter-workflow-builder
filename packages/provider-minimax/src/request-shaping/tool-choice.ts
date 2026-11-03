import type { ToolChoiceCapability } from '@easter-workflow-builder/provider-capability';

export const minimaxToolChoice: ToolChoiceCapability = {
  accepted: {
    state: 'unknown',
    reason:
      'A Flash két azonos any kérésre ellentmondó választ adott (tool_use, majd szöveg), a none egy mintája auto kontroll nélkül nem választható el a modell saját döntésétől.',
    blockedBy: ['M-34'],
  },
  // A tool típusú kényszerítésre két mintában 200 válasz jött tool_use blokk nélkül, de a viselkedés nem determinisztikus.
  rejectionBehaviour: {
    state: 'unknown',
    reason:
      'A tool típusú kényszerítésre két mintában tool_use nélküli szöveg jött, de az any kényszerítés két azonos kérésre ellentmondó választ adott (tool_use, majd szöveg), tehát a viselkedés nem determinisztikus, és a tool esethez nincs azonos promptú auto kontroll, így a csendes eldobás a modell saját döntésétől nem választható el.',
    blockedBy: ['M-34'],
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
