import { UpdateSettingsRequestSchema, zodErrorToProtocolErrorBody } from '@easter-workflow-builder/protocol';
import { isProviderId } from '@easter-workflow-builder/provider-capability';
import type { DatabaseContext } from '@easter-workflow-builder/db';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';

function invalidProviderIdMessage(value: string): string {
  return `A(z) "${value}" defaultProviderId nem ismert provider azonosító (invalid_request).`;
}

/**
 * `PUT /api/settings` (SPEC-005 4.2 E táblázat 22. sora). Részleges
 * frissítés: mindkét mező elhagyható, az elhagyott mező érintetlenül hagyja
 * a tárolt beállítást (SPEC-005 4.2 E táblázat, F-20). Az
 * `AppSettingRepository` nincs "töröld a default providert" metódusa,
 * ezzel összhangban a drótszintű séma sem `nullable`, csak `optional` -
 * megadva mindig valódi providerId kell legyen.
 */
export function createUpdateSettingsHandler(database: DatabaseContext): RouteHandler {
  return (context) => {
    const parsedBody = UpdateSettingsRequestSchema.safeParse(context.body);
    if (!parsedBody.success) {
      return Promise.resolve({ kind: 'error', message: zodErrorToProtocolErrorBody(parsedBody.error).message });
    }

    const { defaultProviderId, persistStreamDeltas } = parsedBody.data;

    if (defaultProviderId !== undefined) {
      if (!isProviderId(defaultProviderId)) {
        return Promise.resolve({ kind: 'error', message: invalidProviderIdMessage(defaultProviderId) });
      }
      const set = database.settings.setDefaultProvider(defaultProviderId);
      if (set.kind === 'error') {
        return Promise.resolve(set);
      }
    }

    if (persistStreamDeltas !== undefined) {
      const set = database.settings.setPersistStreamDeltas(persistStreamDeltas);
      if (set.kind === 'error') {
        return Promise.resolve(set);
      }
    }

    const settings = database.settings.readSettings();
    if (settings.kind === 'error') {
      return Promise.resolve(settings);
    }
    return Promise.resolve({ kind: 'ok', value: { status: 200, body: settings.value } });
  };
}
