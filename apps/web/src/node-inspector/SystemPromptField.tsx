import type { PresetSystemPrompt } from '@easter-workflow-builder/protocol';
import { SelectField, TextAreaField } from '@easter-workflow-builder/ui';
import { isString } from '@easter-workflow-builder/typeguards';
import type { ChangeEvent, ReactElement } from 'react';
import { fromTextFieldValue, toTextFieldValue } from './nullable-text-field-value.ts';

export type SystemPromptValue = string | PresetSystemPrompt | null;

export interface SystemPromptFieldProperties {
  readonly value: SystemPromptValue;
  readonly onChange: (nextValue: SystemPromptValue) => void;
  /**
   * A `systemPrompt` mező szintjén jelentkező hibaüzenet (pl. érvénytelen
   * unió alak) - a mód választón jelenik meg, mert az képviseli a mezőt
   * mindhárom ágban (`.claude/CLAUDE.md` mezőnkénti hibajelzés).
   */
  readonly error?: string | undefined;
}

const MODE_OPTIONS = [
  { value: 'none', label: 'nincs megadva' },
  { value: 'text', label: 'szabad szöveg' },
  { value: 'preset', label: 'Claude Code preset' },
];

// A `PresetSystemPrompt` nullázható mezői a dróton ténylegesen `null` értéket
// hordoznak (SPEC-005 protokoll alak).
/* eslint-disable unicorn/no-null */
const DEFAULT_PRESET: PresetSystemPrompt = {
  type: 'preset',
  preset: 'claude_code',
  append: null,
  excludeDynamicSections: null,
};
/* eslint-enable unicorn/no-null */

/**
 * A `systemPrompt` mező vezérlője (SPEC-008 5.2 "prompt és provider"
 * csoport). A mező háromféle lehet: nincs megadva, szabad szöveg, vagy a
 * `PresetSystemPrompt` objektum - a mód választó ezért NEM egy külön,
 * a `value`-tól elszakított állapot, hanem magából a `value` alakjából
 * derül ki minden egyes ágban, hogy a típusszűkítés és a mód azonosítása
 * ugyanaz az ellenőrzés legyen, redundáns pár nélkül.
 */
export function SystemPromptField(properties: Readonly<SystemPromptFieldProperties>): ReactElement {
  const { value, onChange, error } = properties;

  function handleModeChange(event: ChangeEvent<HTMLSelectElement>): void {
    const nextMode = event.target.value;
    if (nextMode === 'none') {
      // eslint-disable-next-line unicorn/no-null -- lásd a `DEFAULT_PRESET` fenti indoklását.
      onChange(null);
      return;
    }
    if (nextMode === 'text') {
      onChange('');
      return;
    }
    if (nextMode === 'preset') {
      onChange(DEFAULT_PRESET);
    }
  }

  if (value === null) {
    return (
      <div className="node-inspector__group">
        <SelectField
          label="Rendszer prompt módja"
          error={error}
          options={MODE_OPTIONS}
          value="none"
          onChange={handleModeChange}
        />
      </div>
    );
  }

  if (isString(value)) {
    return (
      <div className="node-inspector__group">
        <SelectField
          label="Rendszer prompt módja"
          error={error}
          options={MODE_OPTIONS}
          value="text"
          onChange={handleModeChange}
        />
        <TextAreaField
          label="Rendszer prompt szövege"
          value={value}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            onChange(event.target.value);
          }}
        />
      </div>
    );
  }

  return (
    <div className="node-inspector__group">
      <SelectField
        label="Rendszer prompt módja"
        error={error}
        options={MODE_OPTIONS}
        value="preset"
        onChange={handleModeChange}
      />
      <TextAreaField
        label="Preset kiegészítés (append)"
        value={toTextFieldValue(value.append)}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange({ ...value, append: fromTextFieldValue(event.target.value) });
        }}
      />
      <SelectField
        label="Dinamikus szekciók kizárása"
        options={[
          { value: '', label: 'nincs megadva' },
          { value: 'true', label: 'igen' },
          { value: 'false', label: 'nem' },
        ]}
        value={value.excludeDynamicSections === null ? '' : String(value.excludeDynamicSections)}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => {
          const raw = event.target.value;
          // eslint-disable-next-line unicorn/no-null -- lásd fent.
          const nextExcludeDynamicSections = raw === '' ? null : raw === 'true';
          onChange({ ...value, excludeDynamicSections: nextExcludeDynamicSections });
        }}
      />
    </div>
  );
}
