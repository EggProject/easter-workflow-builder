// Barrel: csak újraexport, a csomag publikus felülete az MCP `tools/call` válasz alakja és a
// két konstruktora.

export type { ToolCallResult } from './tool-call-result/tool-call-result.ts';
export { textToolResult } from './tool-call-result/text-tool-result.ts';
export { errorToolResult } from './tool-call-result/error-tool-result.ts';
