import { SelectField, type SelectFieldSize } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';

type BuiltinSkillsChoice = 'inherited' | 'enabled' | 'disabled';

export interface BuiltinSkillsSelectProperties {
  readonly label: string;
  /**
   * Az öröklés opció felirata: a workflow szinten a globális, a lépés szinten
   * a workflow vagy a globális beállítás az örökölt érték.
   */
  readonly inheritedOptionLabel: string;
  readonly value: boolean | null;
  readonly onChange: (value: boolean | null) => void;
  readonly size: SelectFieldSize;
}

function toChoice(value: boolean | null): BuiltinSkillsChoice {
  if (value === null) {
    return 'inherited';
  }
  return value ? 'enabled' : 'disabled';
}

function fromChoice(choice: BuiltinSkillsChoice): boolean | null {
  switch (choice) {
    case 'inherited': {
      // eslint-disable-next-line unicorn/no-null -- a `null` az öröklés (SPEC-009 O-44)
      return null;
    }
    case 'enabled': {
      return true;
    }
    case 'disabled': {
      return false;
    }
  }
}

/**
 * A CLI beépített skilljeinek háromállású felülírás választója (SPEC-009
 * O-44, user döntés 2026-11-04): örökölt (`null`), elérhetők (`true`), nem
 * elérhetők (`false`). A workflow szerkesztő modális és a lépés beállítás
 * panel egyaránt ezt használja, a `packages/ui` `SelectField` mezőjén.
 */
export function BuiltinSkillsSelect(properties: Readonly<BuiltinSkillsSelectProperties>): ReactElement {
  const { label, inheritedOptionLabel, value, onChange, size } = properties;
  return (
    <SelectField<BuiltinSkillsChoice>
      size={size}
      label={label}
      options={[
        { value: 'inherited', label: inheritedOptionLabel },
        { value: 'enabled', label: 'Elérhetők' },
        { value: 'disabled', label: 'Nem elérhetők' },
      ]}
      value={toChoice(value)}
      onChange={(choice) => {
        onChange(fromChoice(choice));
      }}
    />
  );
}
