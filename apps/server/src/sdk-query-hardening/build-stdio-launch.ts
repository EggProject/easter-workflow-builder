import { STDIO_LAUNCHER_SOURCE } from './stdio-launcher-source.ts';

/**
 * A stdio MCP szerver kimenő `command` és `args` mezője (SPEC-009 6.4, O-45): a szerver parancsa az
 * indító programon át fut (`STDIO_LAUNCHER_SOURCE`), a szerver saját Node folyamatával
 * (`process.execPath`), mert a CLI környezetének `PATH` változója nem garantálja a `node` parancsot.
 * A `--` a `node` kapcsolóinak végét jelzi, hogy egy `-` jellel kezdődő argumentum se kapcsolóként
 * értelmeződjön.
 */
export function buildStdioLaunch(
  command: string,
  arguments_: readonly string[],
  allowedNames: readonly string[],
): { readonly command: string; readonly args: readonly string[] } {
  return {
    command: process.execPath,
    args: ['-e', STDIO_LAUNCHER_SOURCE, '--', JSON.stringify(allowedNames), command, ...arguments_],
  };
}
