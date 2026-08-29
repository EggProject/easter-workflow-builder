import { providerRegistry } from '@easter-workflow-builder/provider-registry';
import type { ProviderCapabilityDescriptor } from '@easter-workflow-builder/provider-capability';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';

/**
 * A `ProviderCapabilityDescriptor`-t a drótszintű `ProviderSummary` alakra
 * képezi (SPEC-005 4.2 D táblázat 19. sora): kizárólag a megjelenítéshez
 * szükséges mezőket viszi, env változó ÉRTÉKET soha (SPEC-005 4.2 D
 * táblázat, `.claude/CLAUDE.md` 9. "Titok kezelés").
 */
function toProviderSummary(descriptor: ProviderCapabilityDescriptor<string, string>) {
  return {
    id: descriptor.id,
    displayName: descriptor.displayName,
    models: descriptor.models.map((model) => model.id),
    requiredEnvNames: descriptor.requiredEnv.map((requirement) => requirement.name),
  };
}

/**
 * A tényleges kezelő. Modul szintű függvény, nem a `createListProvidersHandler`
 * belsejében definiált lezárás: nem hivatkozik semelyik hívási paraméterre,
 * a `unicorn/consistent-function-scoping` szabály ezt a szintet kéri.
 */
function handleListProviders(): ReturnType<RouteHandler> {
  return Promise.resolve({
    kind: 'ok',
    value: {
      status: 200,
      body: [toProviderSummary(providerRegistry['claude-subscription']), toProviderSummary(providerRegistry.minimax)],
    },
  });
}

/**
 * `GET /api/providers` (SPEC-005 4.2 D táblázat 19. sora). A két rögzített
 * provider a `provider-registry` csomag `providerRegistry` rekordjából jön,
 * NÉVVEL címezve, nem `Object.keys` iterációval - ugyanaz a minta, mint a
 * `startup-sequence/collect-secret-environment-values.ts`-ben, mert
 * `.claude/CLAUDE.md` 9. szekciója szerint pontosan kettő van.
 */
export function createListProvidersHandler(): RouteHandler {
  return handleListProviders;
}
