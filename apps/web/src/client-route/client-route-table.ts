/**
 * A kliens oldali útvonaltábla (SPEC-007 7.2, 12.2). Ugyanaz a minta, mint a
 * `protocol` csomag `ROUTE_TABLE` táblája (`as const satisfies`), de csak a
 * jelen spec két képernyőjét sorolja fel. A `:workflowId` és a `:runId`
 * paraméteres útvonal (SPEC-008 hatókör) itt szándékosan nem szerepel:
 * paraméter nélküli sablonra nem írható tesztelhető paraméteres ág (SPEC-007
 * 7.2, 13.3).
 */
export const CLIENT_ROUTE_TABLE = {
  workflowList: { template: '/' },
  runHistory: { template: '/runs' },
} as const satisfies Readonly<Record<string, { readonly template: string }>>;

/**
 * A `CLIENT_ROUTE_TABLE` kulcsainak uniója: minden kliens útvonal azonosítója.
 */
export type ClientRouteId = keyof typeof CLIENT_ROUTE_TABLE;
