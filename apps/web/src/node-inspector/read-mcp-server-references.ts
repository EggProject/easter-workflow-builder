import { McpServerReferenceSchema, type McpServerReference } from '@easter-workflow-builder/protocol';
import { isRecord } from '@easter-workflow-builder/typeguards';

/**
 * A tárolt `mcpServerReferences` érték olvasása szerver név szerint
 * (SPEC-009 6.2, O-42). A hiányzó mező (`undefined`) üres hivatkozás-halmaz;
 * `undefined`, ha az érték alakja nem `Record<név, McpServerReference>`
 * (lépésen a séma ezt kizárja, egy agent definíció mezője viszont
 * szűkítetlen). A halmaz `Map`, mert a név `constructor` vagy `__proto__`
 * is lehet.
 */
export function readMcpServerReferences(value: unknown): ReadonlyMap<string, McpServerReference> | undefined {
  if (value === undefined) {
    return new Map();
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const references = new Map<string, McpServerReference>();
  for (const [name, entry] of Object.entries(value)) {
    const parsed = McpServerReferenceSchema.safeParse(entry);
    if (!parsed.success) {
      return undefined;
    }
    references.set(name, parsed.data);
  }
  return references;
}
