import type { LoopNodeConfig } from '@easter-workflow-builder/protocol';
import { TextAreaField, TextField } from '@easter-workflow-builder/ui';
import type { ChangeEvent, ReactElement } from 'react';
import { useFieldError } from './use-field-error.ts';

export interface LoopNodeFieldsProperties {
  readonly config: LoopNodeConfig;
  readonly onChange: (nextConfig: LoopNodeConfig) => void;
}

/**
 * A `loop` node szerkesztett mezői: `maxIterations`, `continueExpression`
 * (SPEC-008 5.1). A `maxIterations` kötelező, szállított alapérték nélkül
 * (`packages/protocol/src/node-config/node-config.ts` doksija), tehát a
 * mező itt sem kap alapértéket. A `maxIterations` a mező `valueAsNumber`
 * értékét kapja, ami üres mezőre `NaN` (HTML Living Standard,
 * `valueAsNumber`; a natív `<input type="number">` az érvénytelen szöveges
 * bevitelre is üres `.value`-t ad, value sanitization:
 * <https://html.spec.whatwg.org/multipage/input.html#number-state-(type=number)>):
 * a kiürített mező így üres marad (a `String(NaN)` értéket a szám mező üresre
 * tisztítja, mint a felvett node kezdő `NaN` értékénél), és a mentés a mező
 * alatt jelez. A korábbi `Number(value)` az üres szövegből `0`-t adott, ami a
 * mezőben `0`-ként jelent meg.
 *
 * CSOPORTOSÍTÁS: nincs összecsukható panel. A `maxIterations` látszólag
 * "futási korlát", valójában viszont a ciklus egyetlen kötelező, alapérték
 * nélküli mezője, tehát minden `loop` node-on ki kell tölteni - elrejteni
 * pontosan a kötelezőt rejtené el.
 */
export function LoopNodeFields(properties: Readonly<LoopNodeFieldsProperties>): ReactElement {
  const { config, onChange } = properties;
  const maxIterationsError = useFieldError('maxIterations');
  const continueExpressionError = useFieldError('continueExpression');

  return (
    <>
      <TextField
        size="sm"
        type="number"
        label="Max. iterációk száma"
        value={String(config.maxIterations)}
        error={maxIterationsError}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          onChange({ ...config, maxIterations: event.target.valueAsNumber });
        }}
      />
      <TextAreaField
        size="sm"
        label="Folytatás feltétel (continueExpression)"
        value={config.continueExpression}
        error={continueExpressionError}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
          onChange({ ...config, continueExpression: event.target.value });
        }}
      />
    </>
  );
}
