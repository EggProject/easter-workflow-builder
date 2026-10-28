import type { FetchFunction } from '@easter-workflow-builder/core';
import type { SkillSummary } from '@easter-workflow-builder/protocol';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useSkillLibrary, type UseSkillLibraryResult } from './use-skill-library.ts';

const API_ORIGIN = 'https://api.example.test';

const ALFA: SkillSummary = { name: 'alfa', description: 'Az alfa skill.', sizeBytes: 100, modifiedAtMs: 1 };
const BETA: SkillSummary = { name: 'beta', description: 'A béta skill.', sizeBytes: 200, modifiedAtMs: 2 };
const GAMMA: SkillSummary = { name: 'gamma', description: 'A gamma skill.', sizeBytes: 300, modifiedAtMs: 3 };

describe('useSkillLibrary', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UseSkillLibraryResult | undefined;

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
    latest = useSkillLibrary(API_ORIGIN, properties.fetchFunction);
    return <span />;
  }

  async function mount(fetchFunction: FetchFunction): Promise<void> {
    await act(async () => {
      root.render(<Probe fetchFunction={fetchFunction} />);
      await Promise.resolve();
    });
  }

  function current(): UseSkillLibraryResult {
    if (latest === undefined) {
      throw new Error('a teszt nem renderelte a hookot');
    }
    return latest;
  }

  it('betöltéskor a GET /api/skills listáját adja success állapotban, a szerver sorrendjében', async () => {
    const requests: string[] = [];
    await mount((input, init) => {
      requests.push(`${init.method ?? ''} ${input}`);
      return Promise.resolve(Response.json([ALFA, BETA]));
    });

    expect(requests).toEqual([`GET ${API_ORIGIN}/api/skills`]);
    expect(current().state).toEqual({ status: 'success', value: [ALFA, BETA] });
  });

  it('a betöltés hibáját failure állapotban adja', async () => {
    await mount(() => Promise.reject(new Error('nincs hálózat')));

    expect(current().state.status).toBe('failure');
  });

  it('a feltöltés a fájl bájtjait nyers application/zip törzsként PUT-olja, siker után újratölti a listát', async () => {
    let skills: readonly SkillSummary[] = [ALFA, GAMMA];
    const requests: string[] = [];
    let uploadedBody: unknown;
    let uploadedContentType: string | undefined;
    await mount((input, init) => {
      requests.push(`${init.method ?? ''} ${new URL(input).pathname}`);
      if (init.method === 'PUT') {
        uploadedBody = init.body;
        uploadedContentType = new Headers(init.headers).get('Content-Type') ?? undefined;
        skills = [ALFA, BETA, GAMMA];
        return Promise.resolve(Response.json(BETA));
      }
      return Promise.resolve(Response.json(skills));
    });
    const archive = new File([new Uint8Array([0x50, 0x4b])], 'beta.zip', { type: 'application/zip' });

    let outcome: Awaited<ReturnType<UseSkillLibraryResult['uploadSkill']>> | undefined;
    await act(async () => {
      outcome = await current().uploadSkill('beta', archive);
    });

    expect(outcome).toEqual({ kind: 'ok', value: BETA });
    expect(requests).toEqual(['GET /api/skills', 'PUT /api/skills/beta', 'GET /api/skills']);
    expect(uploadedBody).toBe(archive);
    expect(uploadedContentType).toBe('application/zip');
    expect(current().state).toEqual({ status: 'success', value: [ALFA, BETA, GAMMA] });
  });

  it('a sikertelen feltöltés hibaágat ad, és a lista változatlan marad, újratöltés nélkül', async () => {
    const requests: string[] = [];
    await mount((input, init) => {
      requests.push(`${init.method ?? ''} ${new URL(input).pathname}`);
      if (init.method === 'PUT') {
        return Promise.resolve(
          Response.json(
            { code: 'unprocessable', message: 'hiba', errorClass: 'skill_archive_too_large' },
            { status: 422 },
          ),
        );
      }
      return Promise.resolve(Response.json([ALFA]));
    });

    let outcome: Awaited<ReturnType<UseSkillLibraryResult['uploadSkill']>> | undefined;
    await act(async () => {
      outcome = await current().uploadSkill('beta', new Blob([]));
    });

    expect(outcome).toMatchObject({ kind: 'error', message: 'A csomag túl nagy.' });
    expect(requests).toEqual(['GET /api/skills', 'PUT /api/skills/beta']);
    expect(current().state).toEqual({ status: 'success', value: [ALFA] });
  });

  it('a törlés DELETE hívás 204 válasszal, a skill kikerül a listából', async () => {
    const requests: string[] = [];
    await mount((input, init) => {
      requests.push(`${init.method ?? ''} ${new URL(input).pathname}`);
      if (init.method === 'DELETE') {
        // eslint-disable-next-line unicorn/no-null -- a DOM `Response` konstruktor törzse `BodyInit | null`, egy üres 204 választ csak `null` törzzsel lehet leírni.
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(Response.json([ALFA, BETA]));
    });

    let outcome: Awaited<ReturnType<UseSkillLibraryResult['deleteSkill']>> | undefined;
    await act(async () => {
      outcome = await current().deleteSkill('alfa');
    });

    expect(outcome).toEqual({ kind: 'ok', value: undefined });
    expect(requests).toEqual(['GET /api/skills', 'DELETE /api/skills/alfa']);
    expect(current().state).toEqual({ status: 'success', value: [BETA] });
  });

  it('a nem létező skill törlése 404 hibaág, a lista változatlan marad', async () => {
    await mount((_input, init) =>
      init.method === 'DELETE'
        ? Promise.resolve(Response.json({ code: 'not_found', message: 'nincs' }, { status: 404 }))
        : Promise.resolve(Response.json([ALFA])),
    );

    let outcome: Awaited<ReturnType<UseSkillLibraryResult['deleteSkill']>> | undefined;
    await act(async () => {
      outcome = await current().deleteSkill('alfa');
    });

    expect(outcome?.kind).toBe('error');
    expect(current().state).toEqual({ status: 'success', value: [ALFA] });
  });
});
