import { tool, type SdkMcpToolDefinition } from '@anthropic-ai/claude-agent-sdk';
import { isOkOutcome } from '@easter-workflow-builder/result';
import { z } from 'zod';
import { ENV_MINIMAX_CODING_PLAN_API_KEY } from '../config/environment-variable-name.ts';
import { resolveMiniMaxConfig } from '../config/resolve-minimax-config.ts';
import { resolveImageDataUrl } from '../image/resolve-image-data-url.ts';
import { callMiniMax } from '../minimax/call-minimax.ts';
import { PATH_VLM } from '../minimax/endpoint-path.ts';
import { isVlmResponse } from '../minimax/is-vlm-response.ts';
import { errorToolResult } from '../result/error-tool-result.ts';
import { textToolResult } from '../result/text-tool-result.ts';
import type { AgentToolDependencies } from './agent-tool-dependencies.ts';

// Lapos séma két kötelező szöveges mezővel, felsorolás és beágyazott objektum
// nélkül.
const inputSchema = {
  prompt: z.string().min(1).describe('What to look for or answer about the image.'),
  image_source: z.string().min(1).describe('Image location: https URL, local file path, or data:image base64 URL.'),
};

const description =
  'Analyze an image and answer a question about it. Supported formats: JPEG, PNG, WebP. Use it whenever the task depends on the actual content of a picture, a screenshot or a diagram.';

/**
 * Képértelmező eszköz a MiniMax képértelmező végpontja fölött. Azért kell, mert
 * a MiniMax Anthropic kompatibilis endpontja a kép bemenetet eldobja: a modell
 * azt állítja, hogy nem kapott képet.
 */
export function createImageUnderstandingTool(
  dependencies: AgentToolDependencies,
): SdkMcpToolDefinition<typeof inputSchema> {
  return tool('understand_image', description, inputSchema, async ({ prompt, image_source }) => {
    const trimmedPrompt = prompt.trim();
    const trimmedSource = image_source.trim();
    if (trimmedPrompt.length === 0 || trimmedSource.length === 0) {
      return errorToolResult('A kérdés és a kép forrása is kötelező, egyik sem lehet üres.');
    }
    const config = resolveMiniMaxConfig(dependencies.environment, ENV_MINIMAX_CODING_PLAN_API_KEY);
    if (!isOkOutcome(config)) {
      return errorToolResult(config.message);
    }
    const dataUrl = await resolveImageDataUrl(
      trimmedSource,
      config.value.timeoutMs,
      dependencies.fetchFunction,
      dependencies.readFileFunction,
    );
    if (!isOkOutcome(dataUrl)) {
      return errorToolResult(dataUrl.message);
    }
    const response = await callMiniMax(
      config.value,
      PATH_VLM,
      { prompt: trimmedPrompt, image_url: dataUrl.value },
      dependencies.fetchFunction,
    );
    if (!isOkOutcome(response)) {
      return errorToolResult(response.message);
    }
    if (!isVlmResponse(response.value)) {
      return errorToolResult('A képértelmező válasza ismeretlen alakú, a szöveges elemzés nem olvasható ki belőle.');
    }
    return textToolResult(response.value.content);
  });
}
