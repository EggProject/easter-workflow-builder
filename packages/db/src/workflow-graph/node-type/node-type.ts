/**
 * A workflow gráf tíz node típusa (SPEC-003 4.3 táblázat; a felsorolás
 * sorrendje a táblázaté). A `workflow_node.type` oszlop a séma szintjén `text`
 * marad, a szűkítést az `isNodeType` guard végzi a repository határon
 * (SPEC-003 4.2 utolsó bekezdése).
 */
export type NodeType =
  | 'start'
  | 'agent_step'
  | 'branch'
  | 'fan_out'
  | 'join'
  | 'loop'
  | 'human_approval'
  | 'error_handler'
  | 'sub_workflow'
  | 'script';
