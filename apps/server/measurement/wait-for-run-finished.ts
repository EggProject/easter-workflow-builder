import type { StreamFrame } from '@easter-workflow-builder/protocol';
import { isRecord, isString, isUnknownArray } from '@easter-workflow-builder/typeguards';

export interface RunFinishedObservation {
  /**
  Az utolsó `sdk_result` esemény `result` szövegének hossza; a szöveg maga nem kerül tovább.
  */
  readonly resultTextLength: number | undefined;
  /**
  Az `init` üzenet plugin skilljei (a `<plugin>:<név>` alakú nevek; a beépítettek nem), ha volt `init`.
  */
  readonly initPluginSkills: readonly string[] | undefined;
  /**
  Az `init` üzenet MCP szervereinek neve és állapota (`sdk.d.ts` `McpServerStatus`), ha volt `init`.
  */
  readonly initMcpServers: readonly string[] | undefined;
}

function resultTextLengthOf(payload: unknown): number | undefined {
  const resultText = isRecord(payload) ? payload['result'] : undefined;
  return isString(resultText) ? resultText.length : undefined;
}

function initPayloadOf(payload: unknown): Readonly<Record<string, unknown>> | undefined {
  return isRecord(payload) && payload['subtype'] === 'init' ? payload : undefined;
}

function pluginSkillsOf(value: unknown): readonly string[] {
  return isUnknownArray(value) ? value.filter(isString).filter((name) => name.includes(':')) : [];
}

function mcpServersOf(value: unknown): readonly string[] {
  return isUnknownArray(value)
    ? value.flatMap((server) =>
        isRecord(server) && isString(server['name']) && isString(server['status'])
          ? [`${server['name']}:${server['status']}`]
          : [],
      )
    : [];
}

/**
 * Várakozás a futás `run_finished` keretére (SPEC-012 5.1 3. lépés). **Nincs
 * időkorlát** (O-15, user döntés): a megszakítás a user dolga. A `protocol_error`
 * keret hibaként áll meg, mert utána a `run_finished` nem biztos, hogy megjön.
 * A kimeneti szöveg hossza az `sdk_result` esemény payloadjából jön (a lépés
 * `output` mezője csak strukturált kimenetnél van kitöltve, a motor
 * `run-agent-step.ts` fájlja szerint). A skill és MCP módban (SPEC-009 T-012-12a) az `init` üzenet
 * plugin skilljei és MCP szerver állapotai is az összegzésbe kerülnek (nevek, nem titkok).
 */
export async function waitForRunFinished(
  frames: AsyncGenerator<StreamFrame>,
  runId: string,
): Promise<RunFinishedObservation> {
  let resultTextLength: number | undefined;
  let initPluginSkills: readonly string[] | undefined;
  let initMcpServers: readonly string[] | undefined;
  for await (const frame of frames) {
    if (frame.event === 'protocol_error') {
      throw new Error(`Protokoll hiba a streamen (${frame.code}).`);
    }
    const event = frame.event === 'run_event' && frame.runEvent.runId === runId ? frame.runEvent : undefined;
    if (event?.kind === 'run_finished') {
      return { resultTextLength, initPluginSkills, initMcpServers };
    }
    resultTextLength = event?.kind === 'sdk_result' ? resultTextLengthOf(event.payload) : resultTextLength;
    const init = event?.kind === 'sdk_system' ? initPayloadOf(event.payload) : undefined;
    if (init !== undefined) {
      initPluginSkills = pluginSkillsOf(init['skills']);
      initMcpServers = mcpServersOf(init['mcp_servers']);
    }
  }
  throw new Error('A stream a run_finished esemény előtt véget ért.');
}
