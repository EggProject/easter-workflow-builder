import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';

/**
 * `GET /api/settings` (SPEC-005 4.2 E táblázat 21. sora). A `db`
 * `AppSettingsRecord` mezőnként megegyezik a drótszintű `SettingsRecord`
 * sémával, ezért nincs átalakítás.
 */
export function createReadSettingsHandler(database: DatabaseContext): RouteHandler {
  return () => {
    const settings = database.settings.readSettings();
    if (settings.kind === 'error') {
      return Promise.resolve(settings);
    }
    return Promise.resolve({ kind: 'ok', value: { status: 200, body: settings.value } });
  };
}
