/**
 * M-19: Stop hook kikényszerítés úgy, hogy a prompt NEM említi az emit_output
 * toolt -- Q8 kiegészítés (nyitva maradt kérdés, kiértékelés 3. szekció 1. pont).
 * Az M-10 megismétlése: ott a prompt szó szerint utasította a modellt az
 * emit_output meghívására, ezért a blokkoló ág sosem aktiválódott. Itt a
 * promptnak triviálisan rövidnek és a toolt nem említőnek kell lennie, hogy a
 * hooknak kelljen kikényszerítenie a hívást.
 */
import { createSdkMcpServer, tool, type HookCallback } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { CaseRunOutcome, MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, executeQuery } from '../harness/runner.ts';
import { NON_PROMPTING_TOOL_ALLOWING_PERMISSION_MODE } from '../harness/sdk-constants.ts';

/** A sikerarányhoz a kiértékelés 3. szekciója szerint 10 futás kell. */
const REPEAT_COUNT = 10;
/**
 * Kemény felső korlát a blokkolások számára, a stop_hook_active loop-védelem
 * MELLETT (nem helyette) -- a feladatleírás mindkettőt kéri, mert a
 * stop_hook_active önmagában is véd, de a mérés célja pont annak
 * ellenőrzése, hogy ez a védelem ténylegesen működik-e MiniMax ellen.
 */
const MAX_BLOCKS = 3;

export const M19: MeasurementCase = {
  id: 'M-19',
  title: 'Stop hook kikényszerítés emit_output említése nélkül',
  question: 'Q8 kiegészítés (nyitva maradt kérdés, kiértékelés 3. szekció 1. pont)',
  async run(ctx) {
    const outcomes: CaseRunOutcome[] = [];
    for (let i = 0; i < REPEAT_COUNT; i += 1) {
      let emitOutputCalled = false;
      let blockCount = 0;

      const emitOutputTool = tool(
        'emit_output',
        'Jelzi, hogy a végső strukturált kimenet elkészült.',
        { result: z.string() },
        async (args) => {
          emitOutputCalled = true;
          return { content: [{ type: 'text', text: `kimenet rögzítve: ${args.result}` }] };
        },
      );
      const workflowServer = createSdkMcpServer({ name: 'workflow', tools: [emitOutputTool] });

      const stopHook: HookCallback = async (input) => {
        if (input.hook_event_name !== 'Stop') {
          return { continue: true };
        }
        if (emitOutputCalled || input.stop_hook_active || blockCount >= MAX_BLOCKS) {
          return { continue: true };
        }
        blockCount += 1;
        return {
          decision: 'block',
          reason: 'Az emit_output tool még nem futott le -- kérlek hívd meg a végeredménnyel.',
        };
      };

      const outcome = await executeQuery({
        ctx,
        caseId: 'M-19',
        runId: `run-${String(i + 1)}`,
        // Szándékosan nem említi az emit_output toolt -- a blokkoló ágnak
        // kell kikényszerítenie a meghívását, nem a promptnak.
        prompt: 'Számold ki mennyi 2+2.',
        options: {
          ...buildBaseOptions(ctx),
          maxTurns: 8,
          mcpServers: { workflow: workflowServer },
          allowedTools: ['mcp__workflow__emit_output'],
          permissionMode: NON_PROMPTING_TOOL_ALLOWING_PERMISSION_MODE,
          allowDangerouslySkipPermissions: true,
          hooks: { Stop: [{ hooks: [stopHook] }] },
        },
      });

      outcomes.push({
        runId: outcome.runId,
        ok: outcome.ok,
        note: `${outcome.note}; blockCount=${String(blockCount)}; emitOutputCalled=${String(emitOutputCalled)}`,
      });
    }
    return outcomes;
  },
};
