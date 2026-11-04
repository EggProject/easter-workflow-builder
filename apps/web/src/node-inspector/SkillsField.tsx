import type { AgentStepConfig } from '@easter-workflow-builder/protocol';
import { isStringArray } from '@easter-workflow-builder/typeguards';
import { Alert, Checkbox, Empty, SelectField } from '@easter-workflow-builder/ui';
import { useContext, type ChangeEvent, type ReactElement } from 'react';
import { ThemedSkeleton } from '../themed-skeleton/ThemedSkeleton.tsx';
import { InspectorFieldGroup } from './InspectorFieldGroup.tsx';
import { describeUnknownValue } from './describe-unknown-value.ts';
import { SkillLibraryContext } from './skill-library-context.ts';
import './node-inspector.css';

type StoredSkills = AgentStepConfig['skills'];

type SkillsMode = 'none' | 'all' | 'list';

const MODE_OPTIONS: readonly { readonly value: SkillsMode; readonly label: string }[] = [
  { value: 'none', label: 'nincs beállítva' },
  { value: 'all', label: 'minden feltöltött skill' },
  { value: 'list', label: 'kiválasztott skillek' },
];

// eslint-disable-next-line unicorn/no-null -- a tárolt `skills` alak `null` értéke jelenti a "nincs beállítva" állapotot, és a hiányzó kulcs is ezt jelenti (SPEC-009 5.2).
const NOT_SET: StoredSkills = null;

/**
 * A módváltás tárolt értéke módonként (a listás mód üres listával indul).
 */
const MODE_DEFAULTS: Readonly<Record<SkillsMode, StoredSkills>> = { none: NOT_SET, all: 'all', list: [] };

/**
 * A tárolt érték módja; `undefined`, ha az érték alakja egyik tárolt alak
 * (`null`, `'all'`, névlista) sem. Lépésen a séma ezt kizárja, egy agent
 * definíció `skills` mezője viszont szűkítetlen (`unknown`).
 */
function readSkillsMode(stored: unknown): SkillsMode | undefined {
  if (stored === NOT_SET) {
    return 'none';
  }
  if (stored === 'all') {
    return 'all';
  }
  return isStringArray(stored) ? 'list' : undefined;
}

/**
 * A módváltás új tárolt értéke: a mód alapértéke (listás módnál üres lista),
 * kivéve, ha az érték már lista (ugyanazon opció újraválasztása nem törölheti
 * a jelöléseket).
 */
function skillsForMode(mode: SkillsMode, stored: unknown): StoredSkills {
  return mode === 'list' && isStringArray(stored) ? stored : MODE_DEFAULTS[mode];
}

/**
 * Egy könyvtárnév bejelölése: a név a tárolt lista végére kerül, a többi elem
 * és a sorrend változatlan.
 */
function withSkillName(storedNames: readonly string[], name: string): readonly string[] {
  return [...storedNames, name];
}

/**
 * Egy könyvtárnév jelölésének levétele: a név kikerül a tárolt listából.
 */
function withoutSkillName(storedNames: readonly string[], name: string): readonly string[] {
  return storedNames.filter((storedName) => storedName !== name);
}

export interface SkillsFieldProperties {
  /**
   * A mező jelenlegi tárolt értéke. `unknown`, mert az agent definíció
   * `skills` mezője szűkítetlen; a hiányzó kulcs (`undefined`) `null`
   * jelentésű.
   */
  readonly value: unknown;
  readonly onChange: (nextValue: StoredSkills) => void;
}

/**
 * A lépés és az agent definíció `skills` mezőjének vezérlője (SPEC-009 5.2,
 * O-14 (a)): `SelectField` módválasztó (nincs beállítva / minden / lista) és a
 * skill könyvtár neveiből épülő `Checkbox` lista. A tárolt alak puszta
 * könyvtárnevek listája (5.3).
 *
 * Egy tárolt név, ami már nincs a könyvtárban (a törlés megengedett, O-13),
 * láthatóan "hiányzik" jelzéssel, bejelölve marad a listán: a mentés nem
 * dobja el csendben, a futás indítása hibával áll meg, és a jelölés levételével
 * vagy a skill újrafeltöltésével oldható fel.
 */
export function SkillsField(properties: Readonly<SkillsFieldProperties>): ReactElement {
  const { value, onChange } = properties;
  const library = useContext(SkillLibraryContext);
  const stored = value === undefined ? NOT_SET : value;
  const mode = readSkillsMode(stored);
  const storedNames = isStringArray(stored) ? stored : [];

  function renderList(): ReactElement {
    if (library.status === 'failure') {
      return <Alert variant="danger">{library.message}</Alert>;
    }
    if (library.status !== 'success') {
      return (
        <div aria-busy="true">
          <ThemedSkeleton shape="text" lines={2} />
        </div>
      );
    }
    const libraryNames = library.value.map((skill) => skill.name);
    const missingNames = [...new Set(storedNames)].filter((name) => !libraryNames.includes(name));
    const rows = [
      ...libraryNames.map((name) => ({ name, label: name })),
      ...missingNames.map((name) => ({ name, label: `${name} (hiányzik a könyvtárból)` })),
    ];
    if (rows.length === 0) {
      return <Empty inline message="Még nincs feltöltött skill. A Beállítások oldalon tölthetsz fel ZIP csomagot." />;
    }
    return (
      <>
        <InspectorFieldGroup title="Feltöltött skillek">
          {rows.map((row) => (
            <Checkbox
              key={row.name}
              label={row.label}
              checked={storedNames.includes(row.name)}
              onChange={(event: ChangeEvent<HTMLInputElement>) => {
                onChange(
                  event.target.checked ? withSkillName(storedNames, row.name) : withoutSkillName(storedNames, row.name),
                );
              }}
            />
          ))}
        </InspectorFieldGroup>
        {missingNames.length > 0 && (
          <p className="node-inspector__reason">
            A könyvtárból hiányzó skillre a futás indítása hibával áll meg: vedd ki a jelölést, vagy töltsd fel újra a
            Beállítások oldalon.
          </p>
        )}
      </>
    );
  }

  return (
    <div className="node-inspector__group">
      <SelectField
        size="sm"
        label="Skillek használata"
        options={MODE_OPTIONS}
        placeholder="ismeretlen alak"
        value={mode ?? ''}
        onChange={(nextMode) => {
          onChange(skillsForMode(nextMode, stored));
        }}
      />
      {mode === undefined && (
        <p className="node-inspector__reason">
          A tárolt érték alakja érvénytelen ({describeUnknownValue(stored)}), a futás indítása ezért hibával áll meg.
          Bármelyik mód kiválasztása felülírja.
        </p>
      )}
      {mode === 'none' && <p className="node-inspector__reason">Nem használ feltöltött skillt.</p>}
      {mode === 'all' && (
        <p className="node-inspector__reason">A futás indításakor a könyvtár minden skilljét használja.</p>
      )}
      {mode === 'list' && renderList()}
    </div>
  );
}
