import type { JoinScriptNodeConfig, NodeConfig, ScriptNodeConfig } from '@easter-workflow-builder/db';

/**
 * A **végrehajtható** node configok uniója: a tárolt `NodeConfig` unió mínusz
 * a két `script` jellegű ág (SPEC-004 4.7, "A validáció eredménye típusszintű
 * szűkítés").
 *
 * A `script` node és a `join` node `script` módja tárolható, de a futás
 * indítása elutasítja (`unimplemented_node_type`, F-19). Mivel a
 * `validateRun` sikeres ága ezt a szűkített uniót adja vissza, a végrehajtó
 * diszpécser kimerítő `switch` szerkezetében **nincs** `script` ág, tehát nem
 * keletkezik olyan kódág, ami logikailag sosem fut, és a 100 százalékos
 * lefedettségi küszöb kizárás nélkül tartható (`.claude/CLAUDE.md` 5.).
 *
 * A `NodeConfig` tíz `NodeType` értéket, de a `join` három módja miatt tizenkét
 * diszkriminált ágat hordoz; az `Exclude` ebből kettőt vesz ki, marad tíz.
 */
export type ExecutableNodeConfig = Exclude<NodeConfig, ScriptNodeConfig | JoinScriptNodeConfig>;
