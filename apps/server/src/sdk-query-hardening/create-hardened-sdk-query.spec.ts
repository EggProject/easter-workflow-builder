/* eslint-disable unicorn/no-null -- az SDK `extraArgs` mezőjében a `null` az érték nélküli kapcsoló (`sdk.d.ts` `extraArgs`) */
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { SdkQueryFunction, SdkQueryHandle } from '@easter-workflow-builder/agent';
import { isRecord, isString } from '@easter-workflow-builder/typeguards';
import { createHardenedSdkQuery } from './create-hardened-sdk-query.ts';

interface Captured {
  readonly options: Readonly<Record<string, unknown>>;
  readonly configPath: string | undefined;
  readonly configText: string | undefined;
  readonly configMode: number | undefined;
}

// Hamis `query()`: rögzíti a kapott Options-t és a hivatkozott fájl tartalmát és jogát a hívás pillanatában.
function fakeQuery(messages: readonly unknown[], captured: Captured[]): SdkQueryFunction {
  return ({ options }) => {
    const extraArguments = options['extraArgs'];
    const configPath =
      isRecord(extraArguments) && isString(extraArguments['mcp-config']) ? extraArguments['mcp-config'] : undefined;
    captured.push({
      options,
      configPath,
      configText: configPath === undefined ? undefined : readFileSync(configPath, 'utf8'),
      configMode: configPath === undefined ? undefined : statSync(configPath).mode & 0o777,
    });
    const handle: SdkQueryHandle = {
      async *[Symbol.asyncIterator](): AsyncGenerator<unknown, void, undefined> {
        await Promise.resolve();
        yield* messages;
      },
      interrupt: async (): Promise<unknown> => {
        await Promise.resolve();
        return 'nyugta';
      },
    };
    return handle;
  };
}

async function drain(handle: SdkQueryHandle): Promise<unknown[]> {
  const received: unknown[] = await Array.fromAsync(handle);
  return received;
}

const HTTP_SERVER = { type: 'http', url: 'http://127.0.0.1:4100/mcp', headers: { Authorization: 'Bearer jelolo' } };

describe('createHardenedSdkQuery', () => {
  it('mcpServers nélkül nincs fájl és nincs extraArgs, a kezelő a hamis kezelő maga', async () => {
    const captured: Captured[] = [];
    const handle = createHardenedSdkQuery(fakeQuery(['a'], captured))({ prompt: 'p', options: { model: 'm' } });
    expect(captured[0]?.options).toStrictEqual({ model: 'm' });
    expect(await drain(handle)).toStrictEqual(['a']);
  });

  it('az mcpServers 0600 jogú fájlba kerül, az extraArgs mcp-config kulcsa mutat rá, a parancssori opcióban nincs érték (O-52)', async () => {
    const captured: Captured[] = [];
    const handle = createHardenedSdkQuery(fakeQuery(['a', 'b'], captured))({
      prompt: 'p',
      options: { model: 'm', extraArgs: { masik: null }, mcpServers: { docs: HTTP_SERVER } },
    });
    const call = captured[0];
    expect(call?.configMode).toBe(0o600);
    expect(JSON.parse(call?.configText ?? '')).toStrictEqual({ mcpServers: { docs: HTTP_SERVER } });
    expect(call?.options).toStrictEqual({ model: 'm', extraArgs: { masik: null, 'mcp-config': call?.configPath } });
    expect(JSON.stringify(call?.options)).not.toContain('jelolo');
    expect(path.basename(call?.configPath ?? '')).toBe('mcp-config.json');
    expect(statSync(path.dirname(call?.configPath ?? '')).mode & 0o777).toBe(0o700);

    expect(await drain(handle)).toStrictEqual(['a', 'b']);
    expect(existsSync(path.dirname(call?.configPath ?? ''))).toBe(false);
  });

  it('a nem rekord extraArgs helyett csak az mcp-config kulcs megy ki', () => {
    const captured: Captured[] = [];
    createHardenedSdkQuery(fakeQuery([], captured))({
      prompt: 'p',
      options: { extraArgs: 'hibas', mcpServers: { docs: HTTP_SERVER } },
    });
    expect(captured[0]?.options).toStrictEqual({ extraArgs: { 'mcp-config': captured[0]?.configPath } });
  });

  it('a fájl a folyam korai lezárásakor (return) is törlődik, és az interrupt a kezelőhöz jut', async () => {
    const captured: Captured[] = [];
    const handle = createHardenedSdkQuery(fakeQuery(['a', 'b'], captured))({
      prompt: 'p',
      options: { mcpServers: { docs: HTTP_SERVER } },
    });
    expect(await handle.interrupt()).toBe('nyugta');
    for await (const message of handle) {
      expect(message).toBe('a');
      break;
    }
    expect(existsSync(path.dirname(captured[0]?.configPath ?? ''))).toBe(false);
  });

  it('ha a query() dob, a könyvtár törlődik és a hiba továbbmegy', () => {
    let seenPath = '';
    const throwing: SdkQueryFunction = ({ options }) => {
      const extraArguments = options['extraArgs'];
      seenPath = isRecord(extraArguments) && isString(extraArguments['mcp-config']) ? extraArguments['mcp-config'] : '';
      throw new Error('indulási hiba');
    };
    expect(() =>
      createHardenedSdkQuery(throwing)({ prompt: 'p', options: { mcpServers: { docs: HTTP_SERVER } } }),
    ).toThrow('indulási hiba');
    expect(seenPath).not.toBe('');
    expect(existsSync(path.dirname(seenPath))).toBe(false);
  });
});
