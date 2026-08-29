import { providerRegistry } from '@easter-workflow-builder/provider-registry';
import type { ProviderDescriptorLookupPort } from '@easter-workflow-builder/engine';

/**
 * A `providerDescriptorLookup` port valódi implementációja: a két rögzített
 * provider leírója a `provider-registry` csomag `providerRegistry`
 * rekordjából (`.claude/CLAUDE.md` 9. szekció). A motor maga nem függ a
 * `provider-registry` csomagtól (SPEC-004 3.2 "Miért nem függ a motor a
 * provider-registry csomagtól"), ezért ez a bekötés az összeállítás
 * (`apps/server`) dolga.
 */
function lookupProviderDescriptor(
  providerId: Parameters<ProviderDescriptorLookupPort>[0],
): ReturnType<ProviderDescriptorLookupPort> {
  return providerRegistry[providerId];
}

export function buildProviderDescriptorLookup(): ProviderDescriptorLookupPort {
  return lookupProviderDescriptor;
}
