/* eslint-disable unicorn/no-null -- a `ScriptConfig` nullázható mezői a dróton ténylegesen `null` értéket hordoznak (SPEC-014 5.3). */
import type { ScriptConfig } from '@easter-workflow-builder/protocol';
import { SelectField, TextAreaField, TextField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import { fromNumberFieldValue, toNumberFieldValue } from './nullable-number-field-value.ts';
import { fromTextFieldValue, toTextFieldValue } from './nullable-text-field-value.ts';
import { TIMEOUT_SECONDS_FIELD_ERROR_MESSAGE } from './timeout-seconds-field-error-message.ts';
import { fromTimeoutSecondsFieldValue, toTimeoutSecondsFieldValue } from './timeout-seconds-field-value.ts';
import { useFieldError } from './use-field-error.ts';

export interface ScriptConfigFieldsProperties {
  readonly config: ScriptConfig;
  readonly onChange: (nextConfig: ScriptConfig) => void;
  /**
   * A mezők útvonalának előtagja a `config`-on belül: a `script` node-on üres,
   * a `join` `script` módjában `settings.` (az `AgentStepConfigFields` mintája).
   */
  readonly fieldPathPrefix: string;
}

/**
 * `as const`, hogy a `SelectField` értéktípusa a két `runtime` ágra szűküljön,
 * és a váltás kezelője kimerítő `switch` lehessen, sosem futó ág nélkül. A
 * `satisfies` őrzi, hogy minden felsorolt érték valóban `ScriptConfig` ág legyen.
 */
const RUNTIME_OPTIONS = [
  { value: 'expression', label: 'CEL kifejezés' },
  { value: 'javascript', label: 'JavaScript' },
] as const satisfies readonly { readonly value: ScriptConfig['runtime']; readonly label: string }[];

/**
 * A szkript beállítás mezői, a `script` node és a `join` `script` mód közös
 * szerkesztője (SPEC-014 5.9): `runtime` választó, `source`, és JavaScript
 * esetén az időkorlát (másodpercben), a munkakönyvtár és a memória korlát.
 * A három JavaScript mező alapértelmezése (üresen) a mező `placeholder`
 * szövege: a design systemben nincs külön segédszöveg elem a mezők alatt, a
 * placeholder pedig pont addig látszik, amíg az üres mező az alapértéket jelenti.
 *
 * CSOPORTOSÍTÁS: nincs összecsukható panel. A három JavaScript mező csak a
 * JavaScript ág kiválasztása után jelenik meg, és a futás szempontjából
 * lényeges (határidő, hozzáférési gyökér, memória), elrejtésük plusz kattintást
 * adna a ritkán szerkesztett mezők panelének hasznához képest.
 */
export function ScriptConfigFields(properties: Readonly<ScriptConfigFieldsProperties>): ReactElement {
  const { config, onChange, fieldPathPrefix } = properties;
  const sourceError = useFieldError(`${fieldPathPrefix}source`);
  // A séma ezredmásodpercben fogalmaz, a mező másodpercben szerkeszt: a mező
  // alatt a saját, másodperces mondat áll (T-015-12).
  const timeoutError =
    useFieldError(`${fieldPathPrefix}timeoutMs`) === undefined ? undefined : TIMEOUT_SECONDS_FIELD_ERROR_MESSAGE;
  const cwdError = useFieldError(`${fieldPathPrefix}cwd`);
  const memoryLimitError = useFieldError(`${fieldPathPrefix}memoryLimitMb`);

  /**
   * A `SelectField` az aktuális opció újraválasztásakor is hív, ezt a
   * JavaScript mezők törlése nélkül el kell nyelni. A cél ág alakjára váltás
   * megtartja a `source` mezőt (SPEC-014 5.9).
   */
  function handleRuntimeChange(nextRuntime: ScriptConfig['runtime']): void {
    if (nextRuntime === config.runtime) {
      return;
    }
    switch (nextRuntime) {
      case 'expression': {
        onChange({ runtime: 'expression', source: config.source });
        break;
      }
      case 'javascript': {
        onChange({ runtime: 'javascript', source: config.source, timeoutMs: null, cwd: null, memoryLimitMb: null });
        break;
      }
    }
  }

  return (
    <>
      <SelectField
        size="sm"
        label="Futásidő (runtime)"
        options={RUNTIME_OPTIONS}
        value={config.runtime}
        onChange={handleRuntimeChange}
      />
      <TextAreaField
        size="sm"
        label="Forrás (source)"
        value={config.source}
        error={sourceError}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange({ ...config, source: event.target.value });
        }}
      />
      {config.runtime === 'javascript' && (
        <>
          <TextField
            size="sm"
            type="number"
            step="any"
            label="Időkorlát (másodperc)"
            placeholder="Üresen 60 másodperc"
            value={toTimeoutSecondsFieldValue(config.timeoutMs)}
            error={timeoutError}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              onChange({ ...config, timeoutMs: fromTimeoutSecondsFieldValue(event.target.value) });
            }}
          />
          <TextField
            size="sm"
            label="Munkakönyvtár (cwd)"
            placeholder="Üresen a szerver munkakönyvtára"
            value={toTextFieldValue(config.cwd)}
            error={cwdError}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              onChange({ ...config, cwd: fromTextFieldValue(event.target.value) });
            }}
          />
          <TextField
            size="sm"
            type="number"
            label="Memória korlát (MB)"
            placeholder="Üresen a rendszermemória, legfeljebb 2048 MB"
            value={toNumberFieldValue(config.memoryLimitMb)}
            error={memoryLimitError}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              onChange({ ...config, memoryLimitMb: fromNumberFieldValue(event.target.value) });
            }}
          />
        </>
      )}
    </>
  );
}
