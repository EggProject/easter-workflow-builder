/**
M-10: Stop hook kikényszerítés -- Q8.
*/
import { createSdkMcpServer, tool, type HookCallback } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { CaseRunOutcome, MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, executeQuery } from '../harness/runner.ts';
import { NON_PROMPTING_TOOL_ALLOWING_PERMISSION_MODE } from '../harness/sdk-constants.ts';

/**
Az ismétlésszám a case saját döntése -- a SPEC-000 nem ír elő konkrét értéket.
*/
const REPEAT_COUNT = 3;

export const M10: MeasurementCase = {
  id: 'M-10',
  title: 'Stop hook kikényszerítés',
  question: 'Q8',
  async run(context) {
    const outcomes: CaseRunOutcome[] = [];
    for (let index = 0; index < REPEAT_COUNT; index += 1) {
      let isEmitOutputCalled = false;

      const emitOutputTool = tool(
        'emit_output',
        'Jelzi, hogy a végső strukturált kimenet elkészült.',
        { result: z.string() },
        (arguments_) => {
          isEmitOutputCalled = true;
          return Promise.resolve({ content: [{ type: 'text', text: `kimenet rögzítve: ${arguments_.result}` }] });
        },
      );
      const workflowServer = createSdkMcpServer({ name: 'workflow', tools: [emitOutputTool] });

      // A stop_hook_active mezőt figyeli, hogy ne blokkoljon végtelenül: ha a
      // hook már egyszer blokkolt és a modell megint stopolni próbál anélkül,
      // hogy emit_output lefutott volna, másodszor már átengedjük.
      const stopHook: HookCallback = (input) => {
        if (input.hook_event_name !== 'Stop') {
          return Promise.resolve({ continue: true });
        }
        if (isEmitOutputCalled || input.stop_hook_active) {
          return Promise.resolve({ continue: true });
        }
        return Promise.resolve({
          decision: 'block',
          reason: 'Az emit_output tool még nem futott le -- kérlek hívd meg a végeredménnyel.',
        });
      };

      const outcome = await executeQuery({
        ctx: context,
        caseId: 'M-10',
        runId: `run-${String(index + 1)}`,
        prompt: 'Számold ki mennyi 2+2, majd hívd meg a mcp__workflow__emit_output toolt az eredménnyel.',
        options: {
          ...buildBaseOptions(context),
          maxTurns: 6,
          mcpServers: { workflow: workflowServer },
          allowedTools: ['mcp__workflow__emit_output'],
          permissionMode: NON_PROMPTING_TOOL_ALLOWING_PERMISSION_MODE,
          allowDangerouslySkipPermissions: true,
          hooks: { Stop: [{ hooks: [stopHook] }] },
        },
      });
      outcomes.push(outcome);
    }
    return outcomes;
  },
};
