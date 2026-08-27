import type { ToolCallResult } from './tool-call-result.ts';

/**
Sikeres tool válasz egyetlen szöveges blokkal.
*/
export function textToolResult(text: string): ToolCallResult {
  return { content: [{ type: 'text', text }], isError: false };
}
