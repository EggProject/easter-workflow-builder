import type { FetchFunction } from '@easter-workflow-builder/core';
import { SkillSummarySchema, type SkillSummary } from '@easter-workflow-builder/protocol';
import { useCallback, useEffect, useState } from 'react';
import type { RequestState } from '../request-state/request-state.ts';
import { useRequestState } from '../request-state/use-request-state.ts';
import { arraySchema } from '../rest-client/array-schema.ts';
import { emptyResponseSchema } from '../rest-client/empty-response-schema.ts';
import { requestRouteWithZipBody } from '../rest-client/request-route-with-zip-body.ts';
import { requestRouteWithoutBody } from '../rest-client/request-route-without-body.ts';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';
import { mergeSkill } from './merge-skill.ts';

export interface UseSkillLibraryResult {
  /**
   * A betöltés állapota; a betöltés után mindig a legutóbb ismert lista
   * (`success`), tehát egy későbbi feltöltés vagy törlés hibája nem dobja el
   * a megjelenített skilleket.
   */
  readonly state: RequestState<readonly SkillSummary[]>;
  /**
   * A feltöltés utáni háttér újratöltés állapota: `failure`, ha a szerver
   * sorrendjét hozó `GET` elbukott (a lista ilyenkor a `PUT` válaszával
   * bővített, utolsó ismert állapot). Külön állapot, hogy az újratöltés ne
   * váltsa csontvázra a listát és az űrlapot.
   */
  readonly reloadState: RequestState<readonly SkillSummary[]>;
  /**
   * `PUT /api/skills/{name}` nyers ZIP törzzsel (SPEC-009 5.1): siker után a
   * `PUT` válasza azonnal a listába kerül (név szerint rendezve, azonos név
   * cseréjével), utána a lista újratöltődik a szerver sorrendjéért. Az
   * azonnali beillesztés nélkül egy elbukó újratöltés után az azonos nevű
   * következő feltöltés a régi listában keresne, és a felülírás megerősítése
   * kimaradna.
   */
  readonly uploadSkill: (name: string, archive: Blob) => Promise<RouteOutcome<SkillSummary>>;
  /**
   * `DELETE /api/skills/{name}` (204): a skill kikerül a listából.
   */
  readonly deleteSkill: (name: string) => Promise<RouteOutcome<undefined>>;
}

/**
 * A skill könyvtár közös állapota a Beállítások képernyőn (SPEC-009 3.1 4.
 * pont): egy betöltés (`GET /api/skills`, név szerint rendezve), feltöltés
 * (új és felülíró egyaránt) és törlés.
 */
export function useSkillLibrary(apiOrigin: string, fetchFunction: FetchFunction): UseSkillLibraryResult {
  const loadRequest = useRequestState<readonly SkillSummary[]>();
  const reloadRequest = useRequestState<readonly SkillSummary[]>();
  const [skills, setSkills] = useState<readonly SkillSummary[]>([]);
  const { run } = loadRequest;
  const { run: runReload } = reloadRequest;

  const fetchSkills = useCallback(async (): Promise<RouteOutcome<readonly SkillSummary[]>> => {
    const outcome = await requestRouteWithoutBody({
      routeId: 'listSkills',
      responseSchema: arraySchema(SkillSummarySchema),
      fetchFunction,
      apiOrigin,
    });
    if (outcome.kind === 'ok') {
      setSkills(outcome.value);
    }
    return outcome;
  }, [apiOrigin, fetchFunction]);

  useEffect(() => {
    void run(fetchSkills);
  }, [run, fetchSkills]);

  const uploadSkill = useCallback(
    async (name: string, archive: Blob): Promise<RouteOutcome<SkillSummary>> => {
      const outcome = await requestRouteWithZipBody({
        routeId: 'uploadSkill',
        parameters: { name },
        body: archive,
        responseSchema: SkillSummarySchema,
        fetchFunction,
        apiOrigin,
      });
      if (outcome.kind === 'ok') {
        const uploaded = outcome.value;
        setSkills((previous) => mergeSkill(previous, uploaded));
        await runReload(fetchSkills);
      }
      return outcome;
    },
    [apiOrigin, fetchFunction, fetchSkills, runReload],
  );

  const deleteSkill = useCallback(
    async (name: string): Promise<RouteOutcome<undefined>> => {
      const outcome = await requestRouteWithoutBody({
        routeId: 'deleteSkill',
        parameters: { name },
        responseSchema: emptyResponseSchema,
        fetchFunction,
        apiOrigin,
      });
      if (outcome.kind === 'ok') {
        setSkills((previous) => previous.filter((skill) => skill.name !== name));
      }
      return outcome;
    },
    [apiOrigin, fetchFunction],
  );

  const state: RequestState<readonly SkillSummary[]> =
    loadRequest.state.status === 'success' ? { status: 'success', value: skills } : loadRequest.state;

  return { state, reloadState: reloadRequest.state, uploadSkill, deleteSkill };
}
