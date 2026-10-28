import type { ProcessEnvironmentPort } from '@easter-workflow-builder/engine';
import { EnvironmentVariableNameSchema, type ServerEnvironmentNameList } from '@easter-workflow-builder/protocol';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';

/**
 * `GET /api/server-environment-names` (SPEC-009 6.2, O-32 (a)): a szerver
 * folyamat környezetének változó NEVEI, amikből a felület a hozzárendelés
 * szerver oldali nevét választja. Ugyanazt a `processEnvironment` portot
 * olvassa, amin a motor a futáskor feloldja őket, tehát a lista pontosan a
 * feloldható neveket adja.
 *
 * **Értéket soha nem ad ki:** a `readAll` pillanatképből csak a kulcsok
 * maradnak. A lista a név alakú (`EnvironmentVariableNameSchema`, 6.1)
 * neveket tartalmazza, mert a központi definíció és a lépés felülírása csak
 * ilyet menthet; a sorrend UTF-16 kódegység szerinti (a `list-skills.ts`
 * mintája, `localeCompare` nélkül, mert az locale függő). Más szűrés nincs (a kockázatot a SPEC-009 11. szekció
 * mondja ki, a lista a user O-32 döntése).
 */
export function createListServerEnvironmentNamesHandler(
  processEnvironment: Pick<ProcessEnvironmentPort, 'readAll'>,
): RouteHandler {
  return () => {
    const names: ServerEnvironmentNameList = Object.keys(processEnvironment.readAll())
      .filter((name) => EnvironmentVariableNameSchema.safeParse(name).success)
      .toSorted((left, right) => Number(left > right) - Number(left < right));
    return Promise.resolve({ kind: 'ok', value: { status: 200, body: names } });
  };
}
