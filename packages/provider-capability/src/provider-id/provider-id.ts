/**
 * A két támogatott provider azonosítója, backend config fájlokban rögzítve
 * (nincs hozzájuk CRUD felület, SPEC-003 1. szekció). A `provider-registry`
 * `ProviderRegistry` interfésze ezt a uniót használja kulcsként, és minden
 * domain típus, ami providerre hivatkozik (pl. a `packages/db` workflow és
 * lépés táblái), ugyanezt importálja, hogy ne legyen két igazságforrás.
 */
export type ProviderId = 'claude-subscription' | 'minimax';
