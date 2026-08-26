/**
M-03: tool_choice az outputFormat záró fázisában -- Q2.
*/
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, executeQuery } from '../harness/runner.ts';
import { NON_PROMPTING_TOOL_ALLOWING_PERMISSION_MODE } from '../harness/sdk-constants.ts';

const SCHEMA = {
  type: 'object',
  properties: {
    label: { type: 'string' },
    count: { type: 'number' },
  },
  required: ['label', 'count'],
} satisfies Record<string, unknown>;

const echoTool = tool('echo', 'Visszaadja a bemeneti szöveget változatlanul.', { text: z.string() }, (arguments_) =>
  Promise.resolve({ content: [{ type: 'text', text: arguments_.text }] }),
);

const measureServer = createSdkMcpServer({ name: 'measure', tools: [echoTool] });

export const M03: MeasurementCase = {
  id: 'M-03',
  title: 'tool_choice az outputFormat záró fázisában',
  question: 'Q2',
  async run(context) {
    const outcome = await executeQuery({
      ctx: context,
      caseId: 'M-03',
      runId: 'a',
      prompt:
        'Hívd meg a mcp__measure__echo toolt a "teszt" szöveggel, majd foglald össze az eredményt a megadott séma szerint.',
      options: {
        ...buildBaseOptions(context),
        maxTurns: 5,
        outputFormat: { type: 'json_schema', schema: SCHEMA },
        mcpServers: { measure: measureServer },
        allowedTools: ['mcp__measure__echo'],
        permissionMode: NON_PROMPTING_TOOL_ALLOWING_PERMISSION_MODE,
        allowDangerouslySkipPermissions: true,
      },
    });
    return [outcome];
  },
};
