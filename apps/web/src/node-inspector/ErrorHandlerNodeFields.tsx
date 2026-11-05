import type { ErrorHandlerNodeConfig, HandledErrorKind } from '@easter-workflow-builder/protocol';
import { Checkbox, TextField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import { HANDLED_ERROR_KIND_OPTION_GROUPS } from './handled-error-kind-options.ts';
import { InspectorFieldGroup } from './InspectorFieldGroup.tsx';
import { LineListTextAreaField } from './LineListTextAreaField.tsx';
import { fromNumberListFieldValue, toNumberListFieldValue } from './number-list-field-value.ts';
import { useFieldError } from './use-field-error.ts';

/**
 * Egy hibafajta bejelölése: a fajta a lista végére kerül, a többi elem és a
 * sorrend változatlan.
 */
function withHandledErrorKind(
  handledErrorKinds: readonly HandledErrorKind[],
  kind: HandledErrorKind,
): readonly HandledErrorKind[] {
  return [...handledErrorKinds, kind];
}

/**
 * Egy hibafajta jelölésének levétele: a fajta kikerül a listából.
 */
function withoutHandledErrorKind(
  handledErrorKinds: readonly HandledErrorKind[],
  kind: HandledErrorKind,
): readonly HandledErrorKind[] {
  return handledErrorKinds.filter((storedKind) => storedKind !== kind);
}

export interface ErrorHandlerNodeFieldsProperties {
  readonly config: ErrorHandlerNodeConfig;
  readonly onChange: (nextConfig: ErrorHandlerNodeConfig) => void;
}

/**
 * A `error_handler` node szerkesztett mezői: `maxAttempts`, `backoffMs`,
 * `handledErrorKinds` (SPEC-008 5.1). A `maxAttempts` kötelező, szállított
 * alapérték nélkül, ugyanúgy, mint a `loop` `maxIterations` mezője.
 *
 * A `maxAttempts` a mező `valueAsNumber` értékét kapja, ami üres mezőre `NaN`
 * (HTML Living Standard, `valueAsNumber`): a kiürített mező így üres marad (a
 * `String(NaN)` értéket a szám mező üresre tisztítja, mint a felvett node
 * kezdő `NaN` értékénél), és a mentés a mező alatt jelez. A korábbi
 * `Number(value)` az üres szövegből `0`-t adott, ami a mezőben `0`-ként jelent
 * meg.
 *
 * A `handledErrorKinds` zárt lista (SPEC-004 8.2, O-5, user döntés 2026-11-04,
 * "Zárt lista"): a motor kezelőig eljutó hibafajtái közül jelölőnégyzetekkel
 * választható, csomópont fajta szerinti csoportokban, a design system
 * `Checkbox` elemével (ugyanaz a minta, mint a `SkillsField` listája). Elgépelni
 * nem lehet, ezért a mezőnek nincs saját hibaüzenete. Az üres lista minden
 * hibafajtát kezel, ezt a mező alatti mondat kimondja.
 *
 * CSOPORTOSÍTÁS: nincs összecsukható panel. A három mező EGYÜTT maga az
 * újrapróbálkozási szabály, vagyis a node teljes tartalma - itt nincs
 * "haladó" réteg, amit el lehetne rejteni.
 */
export function ErrorHandlerNodeFields(properties: Readonly<ErrorHandlerNodeFieldsProperties>): ReactElement {
  const { config, onChange } = properties;
  const maxAttemptsError = useFieldError('maxAttempts');
  const backoffMsError = useFieldError('backoffMs');

  return (
    <>
      <TextField
        size="sm"
        type="number"
        label="Max. próbálkozások száma"
        value={String(config.maxAttempts)}
        error={maxAttemptsError}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange({ ...config, maxAttempts: event.target.valueAsNumber });
        }}
      />
      <LineListTextAreaField
        label="Várakozás próbálkozásonként, ms (soronként egy szám)"
        value={config.backoffMs}
        toText={toNumberListFieldValue}
        fromText={fromNumberListFieldValue}
        error={backoffMsError}
        onChange={(backoffMs) => {
          onChange({ ...config, backoffMs });
        }}
      />
      <InspectorFieldGroup title="Kezelt hibafajták">
        <p className="node-inspector__reason">
          {config.handledErrorKinds.length === 0
            ? 'Egyik sincs bejelölve, ezért a csomópont minden hibafajtát kezel.'
            : 'Csak a bejelölt hibafajtákat kezeli, a többit nem.'}
        </p>
        {HANDLED_ERROR_KIND_OPTION_GROUPS.map((group) => (
          <InspectorFieldGroup key={group.title} title={group.title}>
            {group.options.map((option) => (
              <Checkbox
                key={option.value}
                label={option.label}
                checked={config.handledErrorKinds.includes(option.value)}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  onChange({
                    ...config,
                    handledErrorKinds: event.target.checked
                      ? withHandledErrorKind(config.handledErrorKinds, option.value)
                      : withoutHandledErrorKind(config.handledErrorKinds, option.value),
                  });
                }}
              />
            ))}
          </InspectorFieldGroup>
        ))}
      </InspectorFieldGroup>
    </>
  );
}
