import type { JoinUnselectedNodeConfig, NodeConfig } from '@easter-workflow-builder/db';

/**
 * A `malformed_node_config` ellenőrzés után maradó node configok uniója: a
 * tárolt `NodeConfig` unió mínusz a választatlan `join` ág (`mode: null`,
 * SPEC-008 5.4, O-33). A `db` ezt az ágat tárolja és olvassa, a motor viszont
 * a futás indításakor `malformed_node_config` hibával elutasítja (user döntés
 * 2026-10-14, SPEC-004 4.7).
 *
 * A `validateNodeConfigs` sikeres ága ezt a szűkített uniót adja vissza,
 * tehát sem a `validateImplementedNodeTypes`, sem a végrehajtó diszpécser nem
 * lát `mode: null` ágat: a `join` módjain futó kimerítő `switch` szerkezetben
 * nem keletkezik garantáltan sosem futó `case null` (`.claude/CLAUDE.md` 5.
 * szekció, 100 százalékos lefedettség).
 */
export type WellFormedNodeConfig = Exclude<NodeConfig, JoinUnselectedNodeConfig>;
