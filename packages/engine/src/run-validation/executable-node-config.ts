import type { JoinScriptNodeConfig, ScriptNodeConfig } from '@easter-workflow-builder/db';
import type { WellFormedNodeConfig } from './well-formed-node-config.ts';

/**
 * A **végrehajtható** node configok uniója: az érvényes (`WellFormedNodeConfig`)
 * unió mínusz a két `script` jellegű ág (SPEC-004 4.7, "A validáció eredménye
 * típusszintű szűkítés").
 *
 * A `script` node és a `join` node `script` módja tárolható, de a futás
 * indítása elutasítja (`unimplemented_node_type`, F-19). Mivel a
 * `validateRun` sikeres ága ezt a szűkített uniót adja vissza, a végrehajtó
 * diszpécser kimerítő `switch` szerkezetében **nincs** `script` ág, tehát nem
 * keletkezik olyan kódág, ami logikailag sosem fut, és a 100 százalékos
 * lefedettségi küszöb kizárás nélkül tartható (`.claude/CLAUDE.md` 5.).
 *
 * A `NodeConfig` tíz `NodeType` értéket, de a `join` négy ága miatt tizenhárom
 * diszkriminált ágat hordoz; a `WellFormedNodeConfig` ebből a választatlan
 * `join` ágat veszi ki (`malformed_node_config`, SPEC-008 O-33), az `Exclude`
 * a két `script` jellegűt, marad tíz.
 */
export type ExecutableNodeConfig = Exclude<WellFormedNodeConfig, ScriptNodeConfig | JoinScriptNodeConfig>;
