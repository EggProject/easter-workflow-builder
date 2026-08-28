/**
 * Az agent futtató port (SPEC-004 3.2 táblázat, `agentQueryRunner` sor): a
 * motorba befecskendezett `AgentQueryRunner`, ahogy az `agent` csomag
 * barrelje exportálja. A típus az `agent` csomagban él (SPEC-004 3.3), mert
 * az `agent` (L4) nem importálhat a motorból (L5), viszont az L5 felől az L4
 * él megengedett; itt csak port szerepében újraexportálva.
 */
export type { AgentQueryRunner } from '@easter-workflow-builder/agent';
