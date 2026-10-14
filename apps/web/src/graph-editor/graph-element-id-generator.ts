/**
 * A gráf elem azonosító generáló port (SPEC-008 5.8, user döntés 8.): a
 * csomópont és az él azonosítója is ezen át jön, hogy a teszt determinisztikus
 * legyen. A böngésző oldali megvalósítás a `crypto.randomUUID()` hívás
 * (`browser-graph-element-id-generator.ts`). A `workflow_node.id` és a
 * `workflow_edge.id` globális elsődleges kulcs, ezért az azonosítónak a
 * workflow-k között is egyedinek kell lennie.
 */
export type GraphElementIdGenerator = () => string;
