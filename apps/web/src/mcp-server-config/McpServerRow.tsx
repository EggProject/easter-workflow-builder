import type { McpServerDefinitionRecord } from '@easter-workflow-builder/protocol';
import { Button } from '@easter-workflow-builder/ui';
import { useId, type ReactElement } from 'react';
import { describeMcpServer } from './describe-mcp-server.ts';

export interface McpServerRowProperties {
  readonly server: McpServerDefinitionRecord;
  readonly onEdit: (server: McpServerDefinitionRecord) => void;
  readonly onDelete: (server: McpServerDefinitionRecord) => void;
}

/**
 * Egy központi MCP szerver sora a Beállítások kártyán (SPEC-009 3.1 5. pont,
 * 6.2): a név, a leíró két sor (típus és parancs vagy URL; a deklarált
 * változók az alapértelmezett hozzárendeléssel) és a "Szerkesztés" és
 * "Törlés" gomb, amik a modálist nyitják. A sor a design system
 * `preference-row` mintája.
 */
export function McpServerRow(properties: Readonly<McpServerRowProperties>): ReactElement {
  const { server, onEdit, onDelete } = properties;
  const titleId = useId();
  const [summary, environment] = describeMcpServer(server.definition);

  return (
    <div className="preference-row mcp-server-row" role="group" aria-labelledby={titleId}>
      <div className="preference-row__body">
        <span className="preference-row__title" id={titleId}>
          {server.name}
        </span>
        <span className="settings-screen__hint">{summary}</span>
        <span className="settings-screen__hint">{environment}</span>
      </div>
      <div className="mcp-server-row__actions">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          aria-label={`Szerkesztés: ${server.name}`}
          onClick={() => {
            onEdit(server);
          }}
        >
          Szerkesztés
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          aria-label={`Törlés: ${server.name}`}
          onClick={() => {
            onDelete(server);
          }}
        >
          Törlés
        </Button>
      </div>
    </div>
  );
}
