# A Szkript kártya figyelmeztetésének szélessége (SPEC-008 5.1, 14. kritérium, O-43, 2026-10-21)

Kapcsolódó: `docs/spec/SPEC-008-graf-szerkeszto-es-futas-nezet.md` 5.1 és 14.1 O-43;
`docs/research/2026-10-17-spec-008-kriterium-tabla.md` 14. sor. A döntés a user 2026-10-21-i
döntése ("Rövid szöveg").

## 1. A hiba

A PR #52 óta a `script` node kártyáján álló figyelmeztetés ("A motor a futtatáskor
`unimplemented_node_type` hibával elutasítja: nincs implementálva.") nem törik, a `.graph-node-card`
flex konténernek pedig csak `min-width` értéke van. A kártya ezért a tartalom egysoros szélességéig
nő, és a dagre elrendezés bemenetéül szolgáló `GRAPH_NODE_CARD_WIDTH` értéknél szélesebb lesz,
így ráfut a szomszédos kártyára.

## 2. Mérés (saját, valós Chromium, 1600x1000, `graph-node-card.spec.ts` fixtúra)

A kártya `offsetWidth` értéke (elrendezési szélesség, a nagyítás nem torzítja), a `script` kártyán:

| Szöveg                                                                     | Mért szélesség | `GRAPH_NODE_CARD_WIDTH` |
| -------------------------------------------------------------------------- | -------------- | ----------------------- |
| régi: "A motor a futtatáskor ... hibával elutasítja: nincs implementálva." | 525 px         | 358 px                  |
| új: `Nem futtatható: \`unimplemented_node_type\``                          | 358 px         | 358 px                  |

Az új szöveggel a `graph-node-card.css` változatlan, a figyelmeztetés `scrollWidth - clientWidth`
értéke nem pozitív (nincs vágás). A hosszabb magyarázat a lábléc státuszában marad.

## 3. Regressziós teszt és rontás igazolás

`apps/web/e2e/graph-node-card.spec.ts › a script kártyájának szélessége a GRAPH_NODE_CARD_WIDTH,
és a figyelmeztetés nincs levágva`. A konstans importált, nem szám. A régi szöveg visszaállításával
(`GraphNodeCard.tsx`, egy sor) a teszt elbukik (`Expected: 358, Received: 525`), a javított
szöveggel zöld; a rontást `git`-tel nem commitoltuk, a fájl visszaállítva.
