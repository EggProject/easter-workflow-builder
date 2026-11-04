import type { FetchFunction } from '@easter-workflow-builder/core';
import type { McpServerDefinition, McpServerDefinitionRecord } from '@easter-workflow-builder/protocol';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useMcpServerLibrary, type UseMcpServerLibraryResult } from './use-mcp-server-library.ts';

const API_ORIGIN = 'https://api.example.test';

const ALFA_DEFINITION: McpServerDefinition = {
  type: 'stdio',
  command: 'npx',
  args: [],
  envNames: ['TOKEN'],
  envBindings: { TOKEN: 'TOKEN_CEG' },
};
const BETA_DEFINITION: McpServerDefinition = {
  type: 'http',
  url: 'https://mcp.example.test',
  // eslint-disable-next-line unicorn/no-null -- a definíció `authEnvName` mezője `null` a "nincs Authorization" állapotban.
  authEnvName: null,
};

const ALFA: McpServerDefinitionRecord = { name: 'alfa', definition: ALFA_DEFINITION };
const BETA: McpServerDefinitionRecord = { name: 'beta', definition: BETA_DEFINITION };
const GAMMA: McpServerDefinitionRecord = { name: 'gamma', definition: BETA_DEFINITION };

describe('useMcpServerLibrary', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UseMcpServerLibraryResult | undefined;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    latest = undefined;
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function Probe(properties: { readonly fetchFunction: FetchFunction }): ReactElement {
    latest = useMcpServerLibrary(API_ORIGIN, properties.fetchFunction);
    return <span />;
  }

  async function mount(fetchFunction: FetchFunction): Promise<void> {
    await act(async () => {
      root.render(<Probe fetchFunction={fetchFunction} />);
      await Promise.resolve();
    });
  }

  function current(): UseMcpServerLibraryResult {
    if (latest === undefined) {
      throw new Error('a teszt nem renderelte a hookot');
    }
    return latest;
  }

  it('betöltéskor a GET /api/mcp-servers listáját adja success állapotban, a szerver sorrendjében', async () => {
    const requests: string[] = [];
    await mount((input, init) => {
      requests.push(`${init.method ?? ''} ${input}`);
      return Promise.resolve(Response.json([ALFA, BETA]));
    });

    expect(requests).toEqual([`GET ${API_ORIGIN}/api/mcp-servers`]);
    expect(current().state).toEqual({ status: 'success', value: [ALFA, BETA] });
  });

  it('a betöltés hibáját failure állapotban adja', async () => {
    await mount(() => Promise.reject(new Error('nincs hálózat')));

    expect(current().state.status).toBe('failure');
  });

  it('a mentés a definíciót JSON törzzsel PUT-olja a név útvonalon, siker után újratölti a listát', async () => {
    let servers: readonly McpServerDefinitionRecord[] = [ALFA, GAMMA];
    const requests: string[] = [];
    let savedBody: unknown;
    await mount((input, init) => {
      requests.push(`${init.method ?? ''} ${new URL(input).pathname}`);
      if (init.method === 'PUT') {
        savedBody = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
        servers = [ALFA, BETA, GAMMA];
        return Promise.resolve(Response.json(BETA));
      }
      return Promise.resolve(Response.json(servers));
    });

    let outcome: Awaited<ReturnType<UseMcpServerLibraryResult['saveServer']>> | undefined;
    await act(async () => {
      outcome = await current().saveServer('beta', BETA_DEFINITION);
    });

    expect(outcome).toEqual({ kind: 'ok', value: BETA });
    expect(requests).toEqual(['GET /api/mcp-servers', 'PUT /api/mcp-servers/beta', 'GET /api/mcp-servers']);
    expect(savedBody).toEqual(BETA_DEFINITION);
    expect(current().state).toEqual({ status: 'success', value: [ALFA, BETA, GAMMA] });
    expect(current().reloadState).toEqual({ status: 'success', value: [ALFA, BETA, GAMMA] });
  });

  it('siker után a PUT válasza azonnal a listában van, az újratöltés hibája pedig a reloadState hibája, a lista megmarad', async () => {
    let isSaved = false;
    await mount((_input, init) => {
      if (init.method === 'PUT') {
        isSaved = true;
        return Promise.resolve(Response.json(BETA));
      }
      return isSaved
        ? Promise.resolve(Response.json({ code: 'internal', message: 'belső hiba' }, { status: 500 }))
        : Promise.resolve(Response.json([ALFA, GAMMA]));
    });
    expect(current().reloadState).toEqual({ status: 'idle' });

    await act(async () => {
      await current().saveServer('beta', BETA_DEFINITION);
    });

    expect(current().state).toEqual({ status: 'success', value: [ALFA, BETA, GAMMA] });
    expect(current().reloadState.status).toBe('failure');
  });

  it('az azonos nevű mentés a régi sort cseréli a listában, az újratöltés hibája mellett is', async () => {
    const replaced: McpServerDefinitionRecord = { name: 'alfa', definition: BETA_DEFINITION };
    let isSaved = false;
    await mount((_input, init) => {
      if (init.method === 'PUT') {
        isSaved = true;
        return Promise.resolve(Response.json(replaced));
      }
      return isSaved ? Promise.reject(new Error('nincs hálózat')) : Promise.resolve(Response.json([ALFA, BETA]));
    });

    await act(async () => {
      await current().saveServer('alfa', BETA_DEFINITION);
    });

    expect(current().state).toEqual({ status: 'success', value: [replaced, BETA] });
    expect(current().reloadState.status).toBe('failure');
  });

  it('a sikertelen mentés hibaágat ad, és a lista változatlan marad, újratöltés nélkül', async () => {
    const requests: string[] = [];
    await mount((input, init) => {
      requests.push(`${init.method ?? ''} ${new URL(input).pathname}`);
      if (init.method === 'PUT') {
        return Promise.resolve(Response.json({ code: 'invalid_request', message: 'hiba' }, { status: 400 }));
      }
      return Promise.resolve(Response.json([ALFA]));
    });

    let outcome: Awaited<ReturnType<UseMcpServerLibraryResult['saveServer']>> | undefined;
    await act(async () => {
      outcome = await current().saveServer('beta', BETA_DEFINITION);
    });

    expect(outcome?.kind).toBe('error');
    expect(requests).toEqual(['GET /api/mcp-servers', 'PUT /api/mcp-servers/beta']);
    expect(current().state).toEqual({ status: 'success', value: [ALFA] });
  });

  it('a törlés DELETE hívás 204 válasszal, a szerver kikerül a listából', async () => {
    const requests: string[] = [];
    await mount((input, init) => {
      requests.push(`${init.method ?? ''} ${new URL(input).pathname}`);
      if (init.method === 'DELETE') {
        // eslint-disable-next-line unicorn/no-null -- a DOM `Response` konstruktor törzse `BodyInit | null`, egy üres 204 választ csak `null` törzzsel lehet leírni.
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(Response.json([ALFA, BETA]));
    });

    let outcome: Awaited<ReturnType<UseMcpServerLibraryResult['deleteServer']>> | undefined;
    await act(async () => {
      outcome = await current().deleteServer('alfa');
    });

    expect(outcome).toEqual({ kind: 'ok', value: undefined });
    expect(requests).toEqual(['GET /api/mcp-servers', 'DELETE /api/mcp-servers/alfa']);
    expect(current().state).toEqual({ status: 'success', value: [BETA] });
  });

  it('a nem létező szerver törlése 404 hibaág, a lista változatlan marad', async () => {
    await mount((_input, init) =>
      init.method === 'DELETE'
        ? Promise.resolve(Response.json({ code: 'not_found', message: 'nincs' }, { status: 404 }))
        : Promise.resolve(Response.json([ALFA])),
    );

    let outcome: Awaited<ReturnType<UseMcpServerLibraryResult['deleteServer']>> | undefined;
    await act(async () => {
      outcome = await current().deleteServer('alfa');
    });

    expect(outcome?.kind).toBe('error');
    expect(current().state).toEqual({ status: 'success', value: [ALFA] });
  });
});
