import type { SkillSummary } from '@easter-workflow-builder/protocol';
import {
  Alert,
  Button,
  FILE_UPLOAD_SOURCE_LABELS,
  FieldErrorVisibilityContext,
  FileUpload,
  TextField,
} from '@easter-workflow-builder/ui';
import { useId, useState, type ChangeEvent, type ReactElement, type SubmitEvent } from 'react';
import { useRequestState } from '../request-state/use-request-state.ts';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';
import { OverwriteSkillModal } from './OverwriteSkillModal.tsx';
import { parseSkillNameDraft } from './parse-skill-name-draft.ts';

export interface SkillUploadFormProperties {
  /**
   * A már feltöltött skillek: az azonos nevű feltöltés felülírás, és
   * megerősítést kér.
   */
  readonly skills: readonly SkillSummary[];
  readonly uploadSkill: (name: string, archive: Blob) => Promise<RouteOutcome<SkillSummary>>;
}

const INVALID_NAME_MESSAGE =
  'A név 1-64 karakter lehet: kisbetű, szám és kötőjel. Nem kezdődhet és nem végződhet kötőjellel, nem tartalmazhat dupla kötőjelet, és nem tartalmazhatja az "anthropic" vagy a "claude" szót.';

const MISSING_FILE_MESSAGE = 'Válassz ki egy ZIP csomagot.';

interface PendingOverwrite {
  readonly name: string;
  readonly file: File;
  readonly existing: SkillSummary;
}

/**
 * A skill feltöltés űrlapja (SPEC-009 5.1, 5.4): a feltöltéskor megadott név
 * (ez lesz a skill könyvtárának neve, O-12) és egyetlen ZIP csomag a
 * `packages/ui` `FileUpload` komponensével. A hibaüzenet a mező alatt áll
 * (`.claude/CLAUDE.md` 11. szekció): érvénytelen név, vagy hiányzó fájl az
 * első beküldési kísérlet után; érvénytelen értékre a `PUT` nem megy ki. Azonos
 * nevű skill feltöltése a felülírás megerősítő modálisán át megy (O-16). A
 * szerver elutasítása (az 5.4 tizenöt hibaosztálya, magyar mondattal) danger
 * `Alert` az űrlap alatt; siker után az űrlap kiürül. A feltöltő szövegei
 * magyarok; a folyamatjelző, a "feltöltve" és a "sikertelen" felirat sosem
 * jelenik meg (a `fetch` nem ad feltöltési haladást, a sor státuszt nem
 * kap), ezért azok a forrás alapértékén maradnak, és a tipp szövege
 * felülírt, tehát a méretkorlát felirat sem látszik.
 */
export function SkillUploadForm(properties: Readonly<SkillUploadFormProperties>): ReactElement {
  const { skills, uploadSkill } = properties;
  const [nameDraft, setNameDraft] = useState('');
  const [file, setFile] = useState<File | undefined>(undefined);
  const [isSubmitAttempted, setIsSubmitAttempted] = useState(false);
  const [fieldGeneration, setFieldGeneration] = useState(0);
  const [nameGeneration, setNameGeneration] = useState(0);
  const [pendingOverwrite, setPendingOverwrite] = useState<PendingOverwrite | undefined>(undefined);
  const request = useRequestState<SkillSummary>();
  const missingFileErrorId = useId();

  const parsedName = parseSkillNameDraft(nameDraft);
  const isUploading = request.state.status === 'pending';
  const isMissingFileErrorVisible = isSubmitAttempted && file === undefined;

  function startUpload(name: string, archive: File): void {
    void request.run(async () => {
      const outcome = await uploadSkill(name, archive);
      if (outcome.kind === 'ok') {
        setNameDraft('');
        setFile(undefined);
        setIsSubmitAttempted(false);
        setFieldGeneration((generation) => generation + 1);
        setNameGeneration((generation) => generation + 1);
      }
      return outcome;
    });
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (parsedName === undefined || file === undefined) {
      setIsSubmitAttempted(true);
      return;
    }
    const existing = skills.find((skill) => skill.name === parsedName);
    if (existing === undefined) {
      startUpload(parsedName, file);
      return;
    }
    setPendingOverwrite({ name: parsedName, file, existing });
  }

  /**
   * A felülírás csak nyitott modálisnál indulhat: a szűkítés a kezelő
   * definiálásakor történik, hogy ne legyen típusilag sosem futó ág.
   */
  const confirmOverwrite =
    pendingOverwrite === undefined
      ? undefined
      : (): void => {
          setPendingOverwrite(undefined);
          startUpload(pendingOverwrite.name, pendingOverwrite.file);
        };

  return (
    <>
      <FieldErrorVisibilityContext.Provider value={isSubmitAttempted}>
        {/* `noValidate`: a beküldés ellenőrzése a saját szabályon megy (a
            hibaüzenet a MEZŐ ALATT áll, 11. szekció). */}
        <form className="skill-upload-form" noValidate onSubmit={handleSubmit}>
          {/* A `key` siker után újraépíti a mezőt, hogy az "érintett" jelölés is
              törlődjön: különben a kiürült név azonnal hibát mutatna. */}
          <TextField
            key={nameGeneration}
            size="sm"
            label="Skill neve"
            autoComplete="off"
            value={nameDraft}
            error={parsedName === undefined ? INVALID_NAME_MESSAGE : undefined}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setNameDraft(event.target.value);
            }}
          />
          <div>
            <FileUpload
              key={fieldGeneration}
              size="sm"
              multiple={false}
              accept=".zip"
              labels={{
                ...FILE_UPLOAD_SOURCE_LABELS,
                dropPrefix: 'Húzd ide a ZIP csomagot, vagy ',
                browse: 'tallózz',
                remove: (fileName) => `Eltávolítás: ${fileName}`,
              }}
              hint="ZIP csomag, a gyökerében SKILL.md fájllal"
              aria-invalid={isMissingFileErrorVisible ? true : undefined}
              aria-describedby={isMissingFileErrorVisible ? missingFileErrorId : undefined}
              files={file === undefined ? [] : [{ name: file.name, size: file.size }]}
              onFiles={(selectedFiles) => {
                setFile(selectedFiles[0]);
              }}
              onRemove={() => {
                setFile(undefined);
                setFieldGeneration((generation) => generation + 1);
              }}
            />
            {isMissingFileErrorVisible && (
              <span className="field__error" id={missingFileErrorId} role="alert">
                {MISSING_FILE_MESSAGE}
              </span>
            )}
          </div>
          <Button
            type="submit"
            size="sm"
            isLoading={isUploading}
            disabled={isUploading}
            className="skill-upload-form__submit"
          >
            Feltöltés
          </Button>
        </form>
      </FieldErrorVisibilityContext.Provider>
      {request.state.status === 'failure' && <Alert variant="danger">{request.state.message}</Alert>}
      <OverwriteSkillModal
        skill={pendingOverwrite?.existing}
        onConfirm={confirmOverwrite}
        onCancel={() => {
          setPendingOverwrite(undefined);
        }}
      />
    </>
  );
}
