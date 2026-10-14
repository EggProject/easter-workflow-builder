/**
 * A "Hozzáadás" gomb csak ikonos alakjának media query-je (SPEC-008 5.8, user
 * döntés 2026-10-14): a `--ep-screen-sm` token értéke, mint a márkanév
 * szövegének elrejtésénél (`topnav-shell.css`), mert a szűk nézetre nincs
 * pontosabb token. JS-ben áll, mert a `.btn--icon` osztályt media query nem
 * tudja a gombra tenni, a szabályát pedig nem másoljuk saját osztályba
 * (szabálykönyv 11. szekció). A `add-node-compact-media-query.spec.ts` a token
 * fájlból olvassa vissza az értéket (research
 * `2026-10-14-csomopont-felvetel.md` 28. szekció).
 */
export const ADD_NODE_COMPACT_MEDIA_QUERY = '(max-width: 640px)';
