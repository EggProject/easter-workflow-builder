/** M-09: tool argumentum streaming -- Q7. */
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, executeQuery } from '../harness/runner.ts';
import { NON_PROMPTING_TOOL_ALLOWING_PERMISSION_MODE } from '../harness/sdk-constants.ts';

/** Hosszú, ismétlődő szöveg, hogy a tool argumentum streamelése több delta eventet termeljen. */
const LONG_BODY =
  'Ez egy hosszú, ismétlődő szöveg, hogy a tool argumentum streamelése több delta eventet termeljen. '.repeat(20);

export const M09: MeasurementCase = {
  id: 'M-09',
  title: 'Tool argumentum streaming',
  question: 'Q7',
  async run(ctx) {
    const caseDir = join(ctx.outDir, 'M-09');
    const toolInputPath = join(caseDir, 'a.tool-callback-input.json');

    const noteTool = tool(
      'record_note',
      'Rögzít egy jegyzetet cím, címkék és egy hosszú szöveg mezővel.',
      { title: z.string(), tags: z.array(z.string()), body: z.string() },
      async (args) => {
        // A ténylegesen megkapott argumentum a Q7 bájtszintű összevetéshez az
        // sdk-messages.ndjson assistant tool_use inputja ellen. A caseDir-t az
        // executeQuery a run() eleje óta már létrehozta.
        writeFileSync(toolInputPath, JSON.stringify(args, null, 2), 'utf8');
        return { content: [{ type: 'text', text: `rögzítve: ${args.title}` }] };
      },
    );
    const measureServer = createSdkMcpServer({ name: 'measure', tools: [noteTool] });

    const prompt = `Hívd meg a mcp__measure__record_note toolt title="napi jegyzet", tags=["teszt","mérés"], body="${LONG_BODY}" argumentumokkal, szó szerint.`;

    const outcome = await executeQuery({
      ctx,
      caseId: 'M-09',
      runId: 'a',
      prompt,
      options: {
        ...buildBaseOptions(ctx),
        maxTurns: 3,
        mcpServers: { measure: measureServer },
        allowedTools: ['mcp__measure__record_note'],
        permissionMode: NON_PROMPTING_TOOL_ALLOWING_PERMISSION_MODE,
        allowDangerouslySkipPermissions: true,
      },
    });
    return [outcome];
  },
};
