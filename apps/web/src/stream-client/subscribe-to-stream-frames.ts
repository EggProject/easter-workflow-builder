import type { StreamFrame } from '@easter-workflow-builder/protocol';

/**
 * Veszteségmentes feliratkozás a beérkező, már dekódolt keretekre. A
 * visszaadott függvény leiratkoztat.
 *
 * Azért kell a `lastFrame` állapot MELLETT, mert az állapotként tartott
 * utolsó keret egy löketben érkező keretsorozatból csak az utolsót adja át:
 * a React a natív eseménykezelőből jövő frissítéseket egyetlen renderbe
 * vonja össze, tehát az erre épülő effekt a köztes kereteket sosem látja.
 * Saját mérés valós Chromiumban: egyetlen hálózati darabban érkező 10,
 * 1000 és 3000 keretre a `lastFrame` effekt mindhárom esetben EGYSZER futott
 * le (`docs/research/2026-09-23-transcript-panel-meresek.md` 1. szekció). A
 * transcript panelnek minden keret kell, a hívó ezért közvetlenül a
 * kezelőből kapja őket.
 */
export type SubscribeToStreamFrames = (listener: (frame: StreamFrame) => void) => () => void;
