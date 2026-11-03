import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { SdkQueryFunction, SdkQueryHandle } from '@easter-workflow-builder/agent';
import { isRecord } from '@easter-workflow-builder/typeguards';
import { hardenAgentOptions } from './harden-agent-options.ts';

const MCP_CONFIG_FILE_NAME = 'mcp-config.json';

/**
 * Az Agent SDK `query()` függvényének burkolója (SPEC-009 6.4, O-45, O-52, user döntés 2026-10-28).
 *
 * Ha az `Options` `mcpServers` rekordot hordoz, a rekord egy lépésenkénti ideiglenes könyvtár
 * (`mkdtemp`, a Node dokumentációja szerint `0700` jogú) `0600` jogú fájljába kerül
 * (`{ "mcpServers": ... }`, a CLI `--mcp-config` fájl alakja), és az `extraArgs` `mcp-config` kulcsa
 * mutat rá; a CLI a parancssorban így csak az útvonalat látja (mérve: research
 * `2026-10-28-plan-012-vegrehajtas.md` 4.5). A könyvtár a folyam lezárásakor törlődik (kimerülés,
 * `return()` vagy dobott hiba), és akkor is, ha a `query()` maga dob. Hogy a CLI a fájlt csak
 * induláskor olvassa-e, nem ellenőrzött, ezért a törlés a folyam végén, nem az indulás után fut.
 */
export function createHardenedSdkQuery(sdkQuery: SdkQueryFunction): SdkQueryFunction {
  return ({ prompt, options }) => {
    const hardened = hardenAgentOptions(options);
    if (hardened.mcpServers === undefined) {
      return sdkQuery({ prompt, options: hardened.options });
    }
    const directory = mkdtempSync(path.join(tmpdir(), 'easter-mcp-'));
    const removeDirectory = (): void => {
      rmSync(directory, { recursive: true, force: true });
    };
    let handle: SdkQueryHandle;
    try {
      const configPath = path.join(directory, MCP_CONFIG_FILE_NAME);
      writeFileSync(configPath, JSON.stringify({ mcpServers: hardened.mcpServers }), { mode: 0o600, flag: 'wx' });
      const extraArguments = isRecord(hardened.options['extraArgs']) ? hardened.options['extraArgs'] : {};
      handle = sdkQuery({
        prompt,
        options: { ...hardened.options, extraArgs: { ...extraArguments, 'mcp-config': configPath } },
      });
    } catch (error) {
      removeDirectory();
      throw error;
    }
    return {
      async *[Symbol.asyncIterator](): AsyncGenerator<unknown, void, undefined> {
        try {
          yield* handle;
        } finally {
          removeDirectory();
        }
      },
      interrupt: async (): Promise<unknown> => await handle.interrupt(),
    };
  };
}
