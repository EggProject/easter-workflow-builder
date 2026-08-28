/**
 * Egy agent futtatás kérése, a motor és az SDK adapter közötti port határán
 * (SPEC-004 3.3).
 *
 * Az `options` szándékosan `Readonly<Record<string, unknown>>`: a port nem
 * duplikálja az SDK `Options` típusát, mert az SDK verzióhoz kötött és
 * verziónként bővül. A típusos szűkítést a motor `step-options` témája végzi,
 * az adapter csak továbbadja.
 */
export interface AgentQueryRequest {
  readonly prompt: string;
  readonly options: Readonly<Record<string, unknown>>;
}
