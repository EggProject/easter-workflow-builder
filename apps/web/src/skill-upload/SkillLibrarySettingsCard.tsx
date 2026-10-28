import type { SkillSummary } from '@easter-workflow-builder/protocol';
import { Alert, Empty } from '@easter-workflow-builder/ui';
import { useId, useState, type ReactElement } from 'react';
import type { RequestState } from '../request-state/request-state.ts';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';
import { ThemedSkeleton } from '../themed-skeleton/ThemedSkeleton.tsx';
import { DeleteSkillModal } from './DeleteSkillModal.tsx';
import { SkillRow } from './SkillRow.tsx';
import { SkillUploadForm } from './SkillUploadForm.tsx';
import './skill-upload.css';

export interface SkillLibrarySettingsCardProperties {
  readonly skillsState: RequestState<readonly SkillSummary[]>;
  readonly uploadSkill: (name: string, archive: Blob) => Promise<RouteOutcome<SkillSummary>>;
  readonly deleteSkill: (name: string) => Promise<RouteOutcome<undefined>>;
}

/**
 * A Beállítások "Skill könyvtár" kártyája (SPEC-009 3.1 4. pont, 5. szekció):
 * a feltöltött skillek listája név szerint (a szerver sorrendjében), `Empty`
 * üres állapottal (cím nélkül, hogy a kártyák `h3` fejléce között ne álljon
 * másik `h3`), a ZIP feltöltés űrlapja és a törlés megerősítő modálisa.
 * A kártya kimondja a feltöltés két kockázatát: a skill fájl nem tartalmazhat
 * titkot, és a csomag futtatható fájlt is hordozhat, amit az agent a szerver
 * gép felhasználójának jogosultságával futtathat (5.1). A betöltés alatt
 * csontváz, a betöltés hibája danger `Alert`. Kártya a kártyában nincs.
 */
export function SkillLibrarySettingsCard(properties: Readonly<SkillLibrarySettingsCardProperties>): ReactElement {
  const { skillsState, uploadSkill, deleteSkill } = properties;
  const headingId = useId();
  const [skillToDelete, setSkillToDelete] = useState<SkillSummary | undefined>(undefined);

  function renderBody(): ReactElement {
    if (skillsState.status === 'failure') {
      return <Alert variant="danger">{skillsState.message}</Alert>;
    }
    if (skillsState.status !== 'success') {
      return (
        <div aria-busy="true">
          <ThemedSkeleton shape="text" lines={2} />
        </div>
      );
    }
    const skills = skillsState.value;
    return (
      <>
        {skills.length === 0 ? (
          <Empty
            inline
            message="Még nincs feltöltött skill. Tölts fel egy ZIP csomagot, hogy az agent lépések használhassák."
          />
        ) : (
          skills.map((skill) => <SkillRow key={skill.name} skill={skill} onDelete={setSkillToDelete} />)
        )}
        <SkillUploadForm skills={skills} uploadSkill={uploadSkill} />
      </>
    );
  }

  return (
    <section className="card" aria-labelledby={headingId}>
      <div className="card__header">
        <h3 id={headingId}>Skill könyvtár</h3>
      </div>
      <p className="settings-screen__hint">
        A skill fájl nem tartalmazhat titkot (API kulcsot, jelszót, tokent). A csomag futtatható fájlokat is hordozhat,
        amiket az agent az eszközeivel a szerver gép felhasználójának jogosultságával futtathat: a skill nem sandbox,
        csak megbízható csomagot tölts fel.
      </p>
      {renderBody()}
      <DeleteSkillModal
        skill={skillToDelete}
        onClose={() => {
          setSkillToDelete(undefined);
        }}
        deleteSkill={deleteSkill}
      />
    </section>
  );
}
