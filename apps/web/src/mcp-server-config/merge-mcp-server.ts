import type { McpServerDefinitionRecord } from '@easter-workflow-builder/protocol';

/**
 * A mentett szervert a listába illeszti: az azonos nevű sort lecseréli, a
 * többit megtartja, az eredmény név szerint rendezett (UTF-16 kódegység
 * sorrend; a név ASCII betű, szám, `_` és `-`, tehát a szerver `ORDER BY name`
 * bináris sorrendjével egyezik). Új tömböt ad, a bemenetet nem módosítja.
 */
export function mergeMcpServer(
  servers: readonly McpServerDefinitionRecord[],
  saved: McpServerDefinitionRecord,
): readonly McpServerDefinitionRecord[] {
  return [...servers.filter((server) => server.name !== saved.name), saved].toSorted(
    (first, second) => Number(first.name > second.name) - Number(first.name < second.name),
  );
}
