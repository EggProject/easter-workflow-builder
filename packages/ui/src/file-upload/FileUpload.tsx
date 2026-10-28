import {
  useState,
  type AriaAttributes,
  type ChangeEvent,
  type DragEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { joinClassNames } from '../class-name-list/join-class-names.ts';
import { formatBytes } from './format-bytes.ts';
import './file-upload.css';

export type FileUploadSize = 'md' | 'sm';

/**
 * A fájl sorok elemei: a forrás `{ name, size, status?, progress? }` alakja.
 * A `status` hiánya folyamatban lévő feltöltést jelent; a `progress` 0 és 100
 * közé szorítva kerül a sávra.
 */
export interface FileUploadFile {
  readonly name: string;
  readonly size?: number;
  readonly status?: 'done' | 'error';
  readonly progress?: number;
}

/**
 * A feltöltő szövegei. A forrás `FileUpload.jsx` ezeket angolul, beégetve
 * adja; a `labels` prop az egyetlen kiegészítés a forráshoz képest, hogy a
 * magyar felület a saját szövegét adhassa (a `PaginationLabels` mintája). Az
 * alapérték a forrás szövege (`FILE_UPLOAD_SOURCE_LABELS`).
 */
export interface FileUploadLabels {
  /**
   * A fő szöveg a kiemelt "browse" előtt (forrás: `Drop files here or `).
   */
  readonly dropPrefix: string;
  /**
   * A fő szövegben kiemelt rész (forrás: `browse`).
   */
  readonly browse: string;
  /**
   * A tipp szövege az `accept` felirat után (forrás: `up to 25 MB each`).
   */
  readonly sizeLimit: string;
  /**
   * A kész állapot szövege; a látható jelzés elé a forrás `✓ ` jelet teszi,
   * a képernyőolvasó a fájl nevét fűzi elé (forrás: `uploaded`).
   */
  readonly uploaded: string;
  /**
   * A hiba állapot szövege (forrás: `failed`).
   */
  readonly failed: string;
  /**
   * A folyamatjelző hozzáférhető neve a fájl nevével (forrás:
   * `Upload progress for <név>`).
   */
  readonly progress: (fileName: string) => string;
  /**
   * Az eltávolító gomb hozzáférhető neve a fájl nevével (forrás:
   * `Remove <név>`).
   */
  readonly remove: (fileName: string) => string;
}

export const FILE_UPLOAD_SOURCE_LABELS: FileUploadLabels = {
  dropPrefix: 'Drop files here or ',
  browse: 'browse',
  sizeLimit: 'up to 25 MB each',
  uploaded: 'uploaded',
  failed: 'failed',
  progress: (fileName) => `Upload progress for ${fileName}`,
  remove: (fileName) => `Remove ${fileName}`,
};

/**
 * A forrás `FileUpload` propjai, egy az egyben: `onFiles`, `accept`,
 * `multiple`, `size`, `title`, `hint`, `files`, `onRemove` és `className`,
 * plusz a `labels` kiegészítés és a mező hibájának kötése (`aria-describedby`,
 * `aria-invalid`): a forrásban nincs ilyen prop, a natív fájl választóra
 * kerülnek, hogy a mező alatti hibaüzenet a képernyőolvasónak is a mezőhöz
 * tartozzon (`.claude/CLAUDE.md` 11. szekció).
 */
export interface FileUploadProperties {
  /**
   * A kiválasztott vagy ráejtett fájlok.
   */
  readonly onFiles?: (files: readonly File[]) => void;
  /**
   * A natív `<input type="file">` `accept` értéke; a tipp szövegében is
   * megjelenik (pontok nélkül, nagybetűvel).
   */
  readonly accept?: string;
  readonly multiple?: boolean;
  readonly size?: FileUploadSize;
  /**
   * A fő szöveg felülírása.
   */
  readonly title?: ReactNode;
  /**
   * A tipp szövegének felülírása.
   */
  readonly hint?: string;
  /**
   * A feltöltő alatt sorokként kirajzolt fájlok.
   */
  readonly files?: readonly FileUploadFile[];
  /**
   * Megadva minden sor kap eltávolító gombot.
   */
  readonly onRemove?: (file: FileUploadFile) => void;
  readonly className?: string;
  readonly labels?: FileUploadLabels;
  /**
   * A mező alatti hibaüzenet azonosítója, a natív fájl választón.
   */
  readonly 'aria-describedby'?: string | undefined;
  /**
   * A hibás állapot jelzése a natív fájl választón; csak a hibaüzenet
   * megjelenésével együtt szabad igazra állítani.
   */
  readonly 'aria-invalid'?: AriaAttributes['aria-invalid'] | undefined;
}

function clampPercent(progress: number): number {
  return Math.max(0, Math.min(100, Number.isNaN(progress) ? 0 : progress));
}

/**
 * A design system `.dropzone` fájl feltöltő elemének React változata
 * (`eggproject-design-components/components/file-upload/FileUpload.jsx`), a
 * forrás szerkezetével: a `<label>` a rejtett natív fájl választót és a
 * lerakó felületet fogja közre, alatta a `.dropzone-files` sorai. Eltérés a
 * forrástól: az eltávolító gomb `type="button"` (űrlapon belül sem küld be),
 * a forrás használaton kívüli `ref`-je nincs átemelve.
 */
export function FileUpload(properties: Readonly<FileUploadProperties>): ReactElement {
  const {
    onFiles,
    accept,
    multiple = true,
    size = 'md',
    title,
    hint,
    files = [],
    onRemove,
    className,
    labels = FILE_UPLOAD_SOURCE_LABELS,
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
  } = properties;

  const [dragging, setDragging] = useState(false);

  const handleDragOver = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    setDragging(true);
  };
  const handleDrop = (event: DragEvent<HTMLLabelElement>): void => {
    event.preventDefault();
    setDragging(false);
    onFiles?.([...event.dataTransfer.files]);
  };
  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onFiles?.([...(event.target.files ?? [])]);
  };

  const acceptPrefix = accept !== undefined && accept !== '' ? `${accept.replaceAll('.', '').toUpperCase()} · ` : '';

  return (
    <div className={className}>
      <label
        className={joinClassNames('dropzone', size === 'sm' && 'dropzone--small', dragging && 'is-dragging')}
        onDragOver={handleDragOver}
        onDragLeave={() => {
          setDragging(false);
        }}
        onDrop={handleDrop}
      >
        <input
          type="file"
          className="dropzone__input"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
        />
        <span className="dropzone__icon">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 14V4M6 8l4-4 4 4" />
            <path d="M3 14v2.5A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V14" />
          </svg>
        </span>
        <span className="dropzone__copy">
          {title ?? (
            <>
              {labels.dropPrefix}
              <em>{labels.browse}</em>
            </>
          )}
        </span>
        <span className="dropzone__hint">{hint ?? `${acceptPrefix}${labels.sizeLimit}`}</span>
      </label>

      {files.length > 0 && (
        <div className="dropzone-files">
          {files.map((file, index) => (
            <div key={`${String(index)}-${file.name}`} className="dropzone-file">
              <span className="dropzone-file__icon">
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 2.5h6L13 5.5v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1z" />
                  <path d="M10 2.5V5h3" />
                </svg>
              </span>
              <div className="dropzone-file__body">
                <span className="dropzone-file__name">{file.name}</span>
                <span className="dropzone-file__meta">{formatBytes(file.size)}</span>
              </div>
              {file.progress !== undefined && file.status !== 'done' && (
                <div
                  className="dropzone-file__bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(clampPercent(file.progress))}
                  aria-label={labels.progress(file.name)}
                >
                  <span style={{ width: `${String(clampPercent(file.progress))}%` }} />
                </div>
              )}
              {file.status !== undefined && (
                <span
                  className={joinClassNames(
                    'dropzone-file__status',
                    file.status === 'error' && 'dropzone-file__status--error',
                  )}
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <span aria-hidden="true">{file.status === 'done' ? `✓ ${labels.uploaded}` : labels.failed}</span>
                  <span className="dropzone-file__sr">
                    {`${file.name} ${file.status === 'done' ? labels.uploaded : labels.failed}`}
                  </span>
                </span>
              )}
              {onRemove !== undefined && (
                <button
                  type="button"
                  className="dropzone-file__remove"
                  onClick={() => {
                    onRemove(file);
                  }}
                  aria-label={labels.remove(file.name)}
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
