import type { WorkflowNodeInput } from '@easter-workflow-builder/protocol';

/**
 * Van-e a gráfban `script` lépés. A motor ilyen gráfot futás indításkor
 * elutasít, ezért a szerkesztő a "Futás indítása" gombot tiltja (SPEC-008 5.1,
 * 14. kritérium, user döntés 2026-10-21). Zárt listából olvasott, egyetlen
 * típusra vonatkozó tény, nem gráf validáció.
 */
export function hasScriptNode(nodes: readonly Pick<WorkflowNodeInput, 'type'>[]): boolean {
  return nodes.some((node) => node.type === 'script');
}
