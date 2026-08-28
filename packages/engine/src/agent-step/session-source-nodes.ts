/**
 * A gráf **session forrás** node-jai, a `forkSession` döntéshez
 * (SPEC-004 6.4).
 *
 * **Mi számít session forrásnak.** Minden olyan node, ami ténylegesen agent
 * lépést futtat, tehát az `agent_step` node és az `ai_synthesis` módú `join`
 * node (SPEC-004 5.6: "Az `ai_synthesis` mód alobjektuma teljes
 * `AgentStepConfig`, tehát a végrehajtása az 5.2 életciklus"). Az `isolated`
 * módú lépés **is** session forrás: az SDK minden `query()` híváshoz session
 * azonosítót ad (F-16), amit a motor a `system` `init` üzenetből a `step_run`
 * sorra ír (6.3), tehát egy rá következő `continued` lépés ezt a sessiont
 * folytatja. A `sessionMode` nem azt dönti el, keletkezik-e session, hanem
 * azt, hogy a lépés **resume-mal** indul-e.
 *
 * A `continuedNodeIds` a forrásoknak az a részhalmaza, aminek a
 * `sessionMode` értéke `continued`. A 6.4 második feltétele ("egynél több út
 * vezet ki, ami `continued` lépést ér el") ezen a halmazon számol.
 *
 * Mindkét halmaz a pillanatképből számolható, tehát a `forkSession` döntés
 * determinisztikus, nem futásidejű versenyhelyzetből jön (6.4).
 */
export interface SessionSourceNodes {
  readonly sourceNodeIds: ReadonlySet<string>;
  readonly continuedNodeIds: ReadonlySet<string>;
}
