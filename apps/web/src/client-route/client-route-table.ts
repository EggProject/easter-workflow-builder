/**
 * A kliens oldali útvonaltábla (SPEC-007 7.2, 12.2, SPEC-008 5. szekció).
 * Ugyanaz a minta, mint a `protocol` csomag `ROUTE_TABLE` táblája (`as const
 * satisfies`). Négy fix útvonal, paraméteres szegmens nélkül: a szerkesztett
 * workflow és a nézett futás azonosítója a `?workflowId=`/`?runId=` query
 * paraméterből jön (SPEC-008 5. szekció bevezetője, a SPEC-007 10.2 futás
 * előzmény füleinek mintájára), nem az útvonal sablonjából - paraméter
 * nélküli sablonra nem írható tesztelhető paraméteres ág (SPEC-007 7.2,
 * 13.3, SPEC-008 18. kritérium).
 *
 * A `label` az útvonal emberi olvasható neve (SPEC-007 5.1, 2026-09-06
 * kiegészítés): az egyetlen forrása a topnav navigáció linkszövegének és a
 * `AppShell` morzsamenüjének is, hogy ne keletkezzen második, duplikált
 * névlista (`.claude/CLAUDE.md` 5. szekció).
 */
export const CLIENT_ROUTE_TABLE = {
  workflowList: { template: '/', label: 'Workflow-k' },
  runHistory: { template: '/runs', label: 'Futás előzmények' },
  graphEditor: { template: '/editor', label: 'Szerkesztő' },
  runView: { template: '/run', label: 'Futás nézet' },
} as const satisfies Readonly<Record<string, { readonly template: string; readonly label: string }>>;

/**
 * A `CLIENT_ROUTE_TABLE` kulcsainak uniója: minden kliens útvonal azonosítója.
 */
export type ClientRouteId = keyof typeof CLIENT_ROUTE_TABLE;
