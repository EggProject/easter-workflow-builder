import type { StreamFrame } from '@easter-workflow-builder/protocol';

/**
 * Veszteségmentes feliratkozás a beérkező, már dekódolt keretekre. A
 * visszaadott függvény leiratkoztat. Ez az EGYETLEN út, amin a képernyők a
 * kereteket kapják (T-009-25, T-009-25a).
 *
 * Azért nem állapot, mert egy "legutolsó keret" alakú React állapot egy
 * löketben érkező keretsorozatból csak az utolsót adja át: a React a natív
 * eseménykezelőből jövő frissítéseket egy renderbe vonja össze, tehát az
 * erre épülő effekt a köztes kereteket sosem látja (saját mérés,
 * `docs/research/2026-09-23-transcript-panel-meresek.md` 1. szekció). Ez az
 * újratöltést kiváltó jelzéseket is elnyeli: a `run_finished` utáni szinkron
 * `replay_complete` mellett a futás lezárása elveszett
 * (`docs/research/2026-09-23-elo-csomopont-allapot.md`). A korábbi
 * `lastFrame` állapotot ezért a T-009-25a törölte.
 */
export type SubscribeToStreamFrames = (listener: (frame: StreamFrame) => void) => () => void;
