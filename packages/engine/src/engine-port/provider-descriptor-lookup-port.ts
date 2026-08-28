import type { ProviderCapabilityDescriptor, ProviderId } from '@easter-workflow-builder/provider-capability';

/**
 * A provider leíró kereső port (SPEC-004 3.2 táblázat,
 * `providerDescriptorLookup` sor): egy `providerId` alapján adja vissza a
 * hozzá tartozó `ProviderCapabilityDescriptor` értéket.
 *
 * Miért port, nem import: a leíró keresés a `provider-registry` csomag
 * fölött történik, amitől a motor szándékosan nem függ, tehát a motor
 * kódjában egyetlen konkrét provider neve sem szerepelhet, és egy új
 * provider felvétele nem érinti a motort (SPEC-004 3.2, "Miért nem függ a
 * motor a `provider-registry` csomagtól", 11.4). A `ProviderId` és a
 * `ProviderCapabilityDescriptor` **típust** viszont a motor közvetlenül a
 * `provider-capability` csomagból (L1) importálja, mert az L5 felőli él
 * szigorúan csökkenő, tehát megengedett.
 */
export type ProviderDescriptorLookupPort = (providerId: ProviderId) => ProviderCapabilityDescriptor<string, string>;
