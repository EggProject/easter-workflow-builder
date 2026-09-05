import { Button, TextField } from '@easter-workflow-builder/ui';
import { useState, type ChangeEvent, type ReactElement } from 'react';
import { AgentDefinitionEntryFields } from './AgentDefinitionEntryFields.tsx';

export interface AgentsFieldEditorProperties {
  /**
   * Az `AgentStepConfig.agents` mező jelenlegi értéke - `Record<string,
   * unknown>`, mert a `protocol` séma szándékosan nem szűkíti
   * `AgentDefinition` alakra (`.claude/CLAUDE.md` 5. szekció).
   */
  readonly value: Readonly<Record<string, unknown>>;
  readonly onChange: (nextValue: Readonly<Record<string, unknown>>) => void;
}

/**
 * Az `agents` mező kulcsonkénti listája: minden bejegyzés az agent neve
 * plusz egy összecsukható űrlap (SPEC-008 5.2). A bejegyzés felvehető,
 * átnevezhető és törölhető; minden egyes ág RÁOLVASZTVA módosítja a teljes
 * rekordot, sosem cserél (AC60) - a `handleEntryChange` maga is csak a
 * megadott kulcsot írja felül, a `AgentDefinitionEntryFields` pedig ugyanezt
 * teszi eggyel lejjebb, a bejegyzésen belül.
 */
export function AgentsFieldEditor(properties: Readonly<AgentsFieldEditorProperties>): ReactElement {
  const { value, onChange } = properties;
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(new Set());
  const [renameDrafts, setRenameDrafts] = useState<Readonly<Record<string, string>>>({});
  const [newAgentName, setNewAgentName] = useState('');

  const keys = Object.keys(value);

  function toggleExpanded(key: string): void {
    setExpandedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleEntryChange(key: string, nextEntryValue: Readonly<Record<string, unknown>>): void {
    onChange({ ...value, [key]: nextEntryValue });
  }

  function handleRemove(key: string): void {
    const next = Object.fromEntries(Object.entries(value).filter(([existingKey]) => existingKey !== key));
    onChange(next);
  }

  // A `handleAdd` és a `handleRename` szándékosan nem ismétli meg az őket
  // hívó gomb `disabled` feltételét: az érvénytelen eset (üres név, már
  // létező kulcs) a gombon TILTVA van, tehát a kattintás ténylegesen sosem
  // futhat le érvénytelen bemenettel - egy itteni második ellenőrzés
  // garantáltan sosem futó ág lenne (`.claude/CLAUDE.md` 5. szekció).
  function handleAdd(): void {
    const name = newAgentName.trim();
    onChange({ ...value, [name]: { description: '', prompt: '' } });
    setNewAgentName('');
  }

  // A `newKeyDraft`-ot a hívó (a JSX render ág) adja át, ugyanazt az értéket,
  // amit a "Átnevezés" gomb `disabled` feltétele is vizsgál - nem itt
  // derül ki újra a `renameDrafts` rekordból, mert a `Record` index elérés
  // `noUncheckedIndexedAccess` mellett `string | undefined`, és a gomb
  // letiltása miatt a hívás mindig egy MÁR meghatározott piszkozattal
  // történik: egy itteni `?? oldKey` tartalék garantáltan sosem futó ág
  // lenne (`.claude/CLAUDE.md` 5. szekció).
  function handleRename(oldKey: string, newKeyDraft: string): void {
    const newKey = newKeyDraft.trim();
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      next[key === oldKey ? newKey : key] = entry;
    }
    onChange(next);
  }

  return (
    <div className="agents-field-editor">
      {keys.length === 0 && <p>Nincs felvett agent.</p>}
      {keys.map((key) => {
        const isExpanded = expandedKeys.has(key);
        const renameDraft = renameDrafts[key] ?? key;
        return (
          <fieldset key={key}>
            <legend>{key}</legend>
            <div className="agents-field-editor__entry-header">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                aria-expanded={isExpanded}
                onClick={() => {
                  toggleExpanded(key);
                }}
              >
                {isExpanded ? 'Összecsukás' : 'Kibontás'}
              </Button>
              <TextField
                aria-label={`"${key}" agent új neve`}
                value={renameDraft}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  setRenameDrafts((current) => ({ ...current, [key]: event.target.value }));
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                // A "változatlan név" esetet nem kell külön feltételként írni: a `key`
                // maga is tagja a `value` rekordnak, tehát `renameDraft === key` esetén
                // a `renameDraft in value` már önmagában igazat ad.
                disabled={renameDraft.trim() === '' || Object.hasOwn(value, renameDraft)}
                onClick={() => {
                  handleRename(key, renameDraft);
                }}
              >
                Átnevezés
              </Button>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => {
                  handleRemove(key);
                }}
              >
                Törlés
              </Button>
            </div>
            {isExpanded && (
              <AgentDefinitionEntryFields
                value={value[key]}
                onChange={(nextEntryValue) => {
                  handleEntryChange(key, nextEntryValue);
                }}
              />
            )}
          </fieldset>
        );
      })}
      <div className="agents-field-editor__add">
        <TextField
          label="Új agent neve"
          value={newAgentName}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setNewAgentName(event.target.value);
          }}
        />
        <Button
          type="button"
          disabled={newAgentName.trim() === '' || Object.hasOwn(value, newAgentName.trim())}
          onClick={handleAdd}
        >
          Agent hozzáadása
        </Button>
      </div>
    </div>
  );
}
