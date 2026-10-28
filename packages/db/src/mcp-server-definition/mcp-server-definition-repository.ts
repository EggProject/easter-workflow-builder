import { asc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { Outcome } from '@easter-workflow-builder/core';
import { findBlankMcpServerDefinitionField } from './find-blank-mcp-server-definition-field.ts';
import { isMcpServerDefinition } from './is-mcp-server-definition.ts';
import type { McpServerDefinition } from './mcp-server-definition.ts';
import { mcpServerDefinitionTable } from './mcp-server-definition-table.ts';

/**
 * Ugyanaz az aláírás, mint a `DatabaseContext.transaction` (SPEC-003 9.1
 * szekció); nem onnan importáljuk, hogy ne legyen kör, ugyanaz a minta, mint a
 * `provider-concurrency-repository.ts`-ben.
 */
type TransactionFunction = <TValue>(work: () => Outcome<TValue>) => Outcome<TValue>;

/**
 * Egy központi MCP szerver definíció a nevével (SPEC-009 6.1, 6.2).
 */
export interface McpServerDefinitionRecord {
  readonly name: string;
  readonly definition: McpServerDefinition;
}

export interface McpServerDefinitionRepository {
  listDefinitions(): Outcome<readonly McpServerDefinitionRecord[]>;
  saveDefinition(record: McpServerDefinitionRecord): Outcome<void>;
  deleteDefinition(name: string): Outcome<void>;
}

/**
 * A központi MCP szerver lista repositoryja (SPEC-009 6.2, O-31). A
 * hibaosztály neve szó szerint, zárójelben áll az üzenetben (`packages/db`
 * `CLAUDE.md` "Outcome hibaosztály konvenció").
 */
export function createMcpServerDefinitionRepository(
  database: BetterSQLite3Database,
  transaction: TransactionFunction,
): McpServerDefinitionRepository {
  /**
   * A teljes lista név szerint növekvő sorrendben (az SQLite alapértelmezett
   * `BINARY` összevetése; a nevek a mentési szabály szerint ASCII jelek). A
   * `definition` oszlop olvasáskor az `isMcpServerDefinition` guardon megy át:
   * egy korrupt sor `corrupt_mcp_server_definition` hibát ad, nem csendben
   * hibás elemet.
   */
  function listDefinitions(): Outcome<readonly McpServerDefinitionRecord[]> {
    return transaction(() => {
      const rows = database.select().from(mcpServerDefinitionTable).orderBy(asc(mcpServerDefinitionTable.name)).all();
      const records: McpServerDefinitionRecord[] = [];
      for (const row of rows) {
        if (!isMcpServerDefinition(row.definition)) {
          return {
            kind: 'error',
            message: `A(z) "${row.name}" MCP szerver definíciója érvénytelen alakú (corrupt_mcp_server_definition).`,
          };
        }
        records.push({ name: row.name, definition: row.definition });
      }
      return { kind: 'ok', value: records };
    });
  }

  /**
   * Létrehozás vagy teljes csere a név szerint (`INSERT ... ON CONFLICT(name)
   * DO UPDATE`): a REST `PUT` szemantikája, a skill feltöltés mintájára. Az
   * üres kötelező szöveg mező (`stdio` `command`, `sse` és `http` `url`)
   * `blank_required_text_field` hibát ad, a mező nevével, írás nélkül (a
   * `replaceGraph` mintája).
   */
  function saveDefinition(record: McpServerDefinitionRecord): Outcome<void> {
    const blankField = findBlankMcpServerDefinitionField(record.definition);
    if (blankField !== undefined) {
      return {
        kind: 'error',
        message: `A(z) "${record.name}" MCP szerver definíció "${blankField}" kötelező szöveg mezője üres (blank_required_text_field).`,
      };
    }
    return transaction(() => {
      database
        .insert(mcpServerDefinitionTable)
        .values({ name: record.name, definition: record.definition })
        .onConflictDoUpdate({ target: mcpServerDefinitionTable.name, set: { definition: record.definition } })
        .run();
      return { kind: 'ok', value: undefined };
    });
  }

  /**
   * Törlés név szerint. Hivatkozó lépés mellett is megengedett (O-43 (a)): a
   * hivatkozás a node config dokumentumában áll, nem idegen kulcs, és a futás
   * indítása ad rá megnevezett hibát (T-012-11). Nem létező névre `not_found`.
   */
  function deleteDefinition(name: string): Outcome<void> {
    return transaction(() => {
      const result = database.delete(mcpServerDefinitionTable).where(eq(mcpServerDefinitionTable.name, name)).run();
      if (result.changes === 0) {
        return { kind: 'error', message: `A(z) "${name}" MCP szerver definíció nem létezik (not_found).` };
      }
      return { kind: 'ok', value: undefined };
    });
  }

  return { listDefinitions, saveDefinition, deleteDefinition };
}
