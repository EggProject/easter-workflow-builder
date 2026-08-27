import type { ToolCallResult } from './tool-call-result.ts';

/**
 * Hibás tool válasz. Az `isError` mező jelzi a modellnek, hogy a hívás nem
 * sikerült, a szöveg pedig megmondja, mi hiányzik, hogy az agent dönthessen a
 * folytatásról. Kivételt nem dobunk: az megszakítaná a futást.
 */
export function errorToolResult(message: string): ToolCallResult {
  return { content: [{ type: 'text', text: message }], isError: true };
}
