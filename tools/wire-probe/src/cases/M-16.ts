/** M-16: kép bemenet -- descriptor kiegészítő mező (models[].imageInput). */
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, executeQuery } from '../harness/runner.ts';

/** Minimális, érvényes 1x1 pixeles PNG base64-ben, hogy valódi kép content blockot küldjünk. */
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function* imagePrompt(): AsyncGenerator<SDKUserMessage> {
  yield {
    type: 'user',
    message: {
      role: 'user',
      content: [
        { type: 'text', text: 'Milyen színű ez a kép? Egyetlen szóval válaszolj.' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: TINY_PNG_BASE64 } },
      ],
    },
    parent_tool_use_id: null,
  };
}

export const M16: MeasurementCase = {
  id: 'M-16',
  title: 'Kép bemenet',
  question: 'models[].imageInput (descriptor kiegészítő mező)',
  async run(ctx) {
    const outcome = await executeQuery({
      ctx,
      caseId: 'M-16',
      runId: 'a',
      prompt: imagePrompt(),
      options: buildBaseOptions(ctx),
    });
    return [outcome];
  },
};
