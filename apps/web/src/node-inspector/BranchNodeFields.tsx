import type { BranchNodeConfig, BranchOption } from '@easter-workflow-builder/protocol';
import { Button, TextField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import { TextAreaField } from './TextAreaField.tsx';
import { fromTextFieldValue, toTextFieldValue } from './nullable-text-field-value.ts';

export interface BranchNodeFieldsProperties {
  readonly config: BranchNodeConfig;
  readonly onChange: (nextConfig: BranchNodeConfig) => void;
}

const EMPTY_BRANCH: BranchOption = { key: '', label: '' };

/**
 * A `branch` node szerkesztett mezői: `expression`, az ágak listája
 * (`branches[].key`/`label`) és a `defaultBranchKey` (SPEC-008 5.1).
 */
export function BranchNodeFields(properties: Readonly<BranchNodeFieldsProperties>): ReactElement {
  const { config, onChange } = properties;

  function setBranches(nextBranches: readonly BranchOption[]): void {
    onChange({ ...config, branches: nextBranches });
  }

  function updateBranch(index: number, patch: Partial<BranchOption>): void {
    setBranches(
      config.branches.map((branch, branchIndex) => (branchIndex === index ? { ...branch, ...patch } : branch)),
    );
  }

  return (
    <fieldset>
      <legend>elágazás</legend>
      <TextAreaField
        label="Feltétel kifejezés"
        value={config.expression}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange({ ...config, expression: event.target.value });
        }}
      />
      {config.branches.map((branch, index) => (
        <div key={index} className="node-inspector__list-row">
          <TextField
            label="Ág kulcsa"
            value={branch.key}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              updateBranch(index, { key: event.target.value });
            }}
          />
          <TextField
            label="Ág címkéje"
            value={branch.label}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              updateBranch(index, { label: event.target.value });
            }}
          />
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => {
              setBranches(config.branches.filter((_branch, branchIndex) => branchIndex !== index));
            }}
          >
            Törlés
          </Button>
        </div>
      ))}
      <Button
        type="button"
        onClick={() => {
          setBranches([...config.branches, EMPTY_BRANCH]);
        }}
      >
        Ág hozzáadása
      </Button>
      <TextField
        label="Alapértelmezett ág kulcsa (ha egyik feltétel sem talál)"
        value={toTextFieldValue(config.defaultBranchKey)}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange({ ...config, defaultBranchKey: fromTextFieldValue(event.target.value) });
        }}
      />
    </fieldset>
  );
}
