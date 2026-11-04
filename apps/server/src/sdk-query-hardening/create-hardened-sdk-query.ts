import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { SdkQueryFunction, SdkQueryHandle } from '@easter-workflow-builder/agent';
import { isRecord } from '@easter-workflow-builder/typeguards';
import { hardenAgentOptions } from './harden-agent-options.ts';
import { readPluginSkillSelection, type PluginSkillSelection } from './read-plugin-skill-selection.ts';

const MCP_CONFIG_FILE_NAME = 'mcp-config.json';

/**
 * A lépés kiválasztott skilljeinek másolata a lépés ideiglenes könyvtárában, a könyvtár gyökerével
 * azonos nevű mappában (a plugin neve a gyökér könyvtárneve, M-136 4a, tehát a minősített nevek nem
 * változnak); a visszaadott út a kimenő `plugins` gyökér.
 */
function stagePluginSkills(directory: string, selection: PluginSkillSelection): string {
  const stagedRoot = path.join(directory, selection.pluginName);
  mkdirSync(path.join(stagedRoot, 'skills'), { recursive: true });
  for (const name of selection.skillNames) {
    cpSync(path.join(selection.rootDirectory, 'skills', name), path.join(stagedRoot, 'skills', name), {
      recursive: true,
    });
  }
  return stagedRoot;
}

/**
 * Az Agent SDK `query()` függvényének burkolója (SPEC-009 6.4, O-45, O-47, O-52, user döntés 2026-10-28).
 *
 * Ha az `Options` `mcpServers` rekordot hordoz, a rekord egy lépésenkénti ideiglenes könyvtár
 * (`mkdtemp`: a libuv a POSIX `mkdtemp(3)` hívást használja, ami `mkdir(pathname, S_IRWXU)`, azaz
 * `0700` joggal hoz létre, <https://pubs.opengroup.org/onlinepubs/9799919799/functions/mkdtemp.html>)
 * `0600` jogú fájljába kerül
 * (`{ "mcpServers": ... }`, a CLI `--mcp-config` fájl alakja), és az `extraArgs` `mcp-config` kulcsa
 * mutat rá; a CLI a parancssorban így csak az útvonalat látja (mérve: research
 * `2026-10-28-plan-012-vegrehajtas.md` 4.5).
 *
 * Ha az `Options` skill könyvtárat ad (`plugins` és `skills`, `readPluginSkillSelection`), a `plugins`
 * gyökér ugyanebben a könyvtárban a lépés kiválasztott skilljeinek másolatára cserélődik (O-47): az
 * agent definíció al-agentje a `plugins` gyökér minden skilljét látja, a lépés `skills` listájától
 * függetlenül (M-147 A4, A5), a szűkített gyökérből viszont csak a kiválasztottakat (mérve: M-150,
 * research `2026-11-04-spec-009-zaras.md`).
 *
 * A könyvtár a folyam lezárásakor törlődik (kimerülés, `return()` vagy dobott hiba), és akkor is, ha a
 * `query()` maga dob. Hogy a CLI a fájlt csak induláskor olvassa-e, nem ellenőrzött, ezért a törlés a
 * folyam végén, nem az indulás után fut.
 */
export function createHardenedSdkQuery(sdkQuery: SdkQueryFunction): SdkQueryFunction {
  return ({ prompt, options }) => {
    const hardened = hardenAgentOptions(options);
    const skillSelection = readPluginSkillSelection(hardened.options);
    if (skillSelection === undefined && hardened.mcpServers === undefined) {
      return sdkQuery({ prompt, options: hardened.options });
    }
    const directory = mkdtempSync(path.join(tmpdir(), 'easter-step-'));
    const removeDirectory = (): void => {
      rmSync(directory, { recursive: true, force: true });
    };
    let handle: SdkQueryHandle;
    try {
      let outgoing = hardened.options;
      if (hardened.mcpServers !== undefined) {
        const configPath = path.join(directory, MCP_CONFIG_FILE_NAME);
        writeFileSync(configPath, JSON.stringify({ mcpServers: hardened.mcpServers }), { mode: 0o600, flag: 'wx' });
        const extraArguments = isRecord(outgoing['extraArgs']) ? outgoing['extraArgs'] : {};
        outgoing = { ...outgoing, extraArgs: { ...extraArguments, 'mcp-config': configPath } };
      }
      if (skillSelection !== undefined) {
        outgoing = { ...outgoing, plugins: [{ type: 'local', path: stagePluginSkills(directory, skillSelection) }] };
      }
      handle = sdkQuery({ prompt, options: outgoing });
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
