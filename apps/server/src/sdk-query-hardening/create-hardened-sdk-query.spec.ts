/* eslint-disable unicorn/no-null -- az SDK `extraArgs` mezőjében a `null` az érték nélküli kapcsoló (`sdk.d.ts` `extraArgs`) */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
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

describe('createHardenedSdkQuery: a plugins gyökér a lépés kiválasztott skilljeinek másolata (SPEC-009 O-47, M-150)', () => {
  const created: string[] = [];
  afterEach(() => {
    for (const directory of created.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  function library(names: readonly string[]): string {
    const root = path.join(mkdtempSync(path.join(tmpdir(), 'skill-konyvtar-')), 'skills');
    created.push(path.dirname(root));
    for (const name of names) {
      mkdirSync(path.join(root, 'skills', name, 'reszek'), { recursive: true });
      writeFileSync(path.join(root, 'skills', name, 'SKILL.md'), `---\ndescription: ${name}\n---\n`);
      writeFileSync(path.join(root, 'skills', name, 'reszek', 'a.md'), name);
    }
    return root;
  }

  function pluginPathOf(options: Readonly<Record<string, unknown>> | undefined): string {
    const plugins = options?.['plugins'];
    const first: unknown = Array.isArray(plugins) ? plugins[0] : undefined;
    return isRecord(first) && isString(first['path']) ? first['path'] : '';
  }

  it('csak a kiválasztott skillek kerülnek a gyökérbe, azonos plugin névvel, a folyam végén törlődik', async () => {
    const root = library(['alfa', 'beta']);
    let stagedSkills: readonly string[] = [];
    let stagedBody = '';
    const captured: Captured[] = [];
    const inner = fakeQuery(['a'], captured);
    const handle = createHardenedSdkQuery((request) => {
      const staged = pluginPathOf(request.options);
      stagedSkills = readdirSync(path.join(staged, 'skills'));
      stagedBody = readFileSync(path.join(staged, 'skills', 'beta', 'reszek', 'a.md'), 'utf8');
      return inner(request);
    })({ prompt: 'p', options: { plugins: [{ type: 'local', path: root }], skills: ['skills:beta'] } });

    const staged = pluginPathOf(captured[0]?.options);
    expect(path.basename(staged)).toBe('skills');
    expect(staged).not.toBe(root);
    expect(stagedSkills).toStrictEqual(['beta']);
    expect(stagedBody).toBe('beta');
    expect(captured[0]?.options['skills']).toStrictEqual(['skills:beta']);
    expect(captured[0]?.configPath).toBeUndefined();

    expect(await drain(handle)).toStrictEqual(['a']);
    expect(existsSync(staged)).toBe(false);
    expect(readdirSync(path.join(root, 'skills')).toSorted()).toStrictEqual(['alfa', 'beta']);
  });

  it('az üres skills lista üres skills mappájú gyökeret ad (M-150 C3)', () => {
    const root = library(['alfa']);
    let stagedSkills: readonly string[] = ['x'];
    createHardenedSdkQuery(({ options }) => {
      stagedSkills = readdirSync(path.join(pluginPathOf(options), 'skills'));
      return fakeQuery([], [])({ prompt: 'p', options });
    })({ prompt: 'p', options: { plugins: [{ type: 'local', path: root }], skills: [] } });

    expect(stagedSkills).toStrictEqual([]);
  });

  it('a skill gyökér és az MCP config ugyanabban az ideiglenes könyvtárban áll', () => {
    const root = library(['alfa']);
    const captured: Captured[] = [];
    createHardenedSdkQuery(fakeQuery([], captured))({
      prompt: 'p',
      options: { plugins: [{ type: 'local', path: root }], skills: ['skills:alfa'], mcpServers: { docs: HTTP_SERVER } },
    });

    expect(path.dirname(pluginPathOf(captured[0]?.options))).toBe(path.dirname(captured[0]?.configPath ?? ''));
  });

  it('a hiányzó skill mappa másolási hibája a könyvtárat törli és továbbmegy, a query() nem fut', () => {
    const root = library([]);
    // A teszt saját, üres szülő könyvtárban ellenőrzi, hogy az ideiglenes könyvtár nem marad meg; hogy
    // az `os.tmpdir()` a futás közben átírt `TMPDIR` változót követi, az első állítás igazolja.
    const parent = mkdtempSync(path.join(tmpdir(), 'hardened-tmp-'));
    created.push(parent);
    const previous = process.env['TMPDIR'];
    process.env['TMPDIR'] = parent;
    let called = false;
    try {
      expect(tmpdir()).toBe(parent);
      expect(() =>
        createHardenedSdkQuery(() => {
          called = true;
          return fakeQuery([], [])({ prompt: 'p', options: {} });
        })({ prompt: 'p', options: { plugins: [{ type: 'local', path: root }], skills: ['skills:nincs'] } }),
      ).toThrow(/ENOENT/u);
    } finally {
      if (previous === undefined) {
        delete process.env['TMPDIR'];
      } else {
        process.env['TMPDIR'] = previous;
      }
    }
    expect(called).toBe(false);
    expect(readdirSync(parent)).toStrictEqual([]);
  });
});
