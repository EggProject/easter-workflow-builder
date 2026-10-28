import type { ConnectionTestResponse, ProviderSummary } from '@easter-workflow-builder/protocol';
import { Alert, Button, SelectField, type SelectFieldProperties } from '@easter-workflow-builder/ui';
import { useId, useState, type ReactElement } from 'react';
import type { RequestState } from '../request-state/request-state.ts';
import { useRequestState } from '../request-state/use-request-state.ts';
import type { ProviderConnectionTester } from './provider-connection-tester.ts';
import './provider-select.css';

export interface ProviderSelectProperties extends Pick<
  SelectFieldProperties,
  'id' | 'label' | 'size' | 'error' | 'placeholder' | 'loading' | 'loadingLabel'
> {
  /**
   * A választható providerek. Az `id` a mező értéke, a `displayName` az
   * opció felirata.
   */
  readonly providers: readonly Pick<ProviderSummary, 'id' | 'displayName'>[];
  /**
   * A kiválasztott provider azonosítója; az üres sztring az "örökölt" (nincs
   * explicit provider) állapot.
   */
  readonly value: string;
  readonly onChange: (providerId: string) => void;
  /**
   * Az üres értékű ("örökölt") opció felirata. Megadása teszi választhatóvá
   * az örökölt állapotot; a Beállítások globális alapértelmezése nem adja
   * meg, mert ott nincs "nincs" opció (SPEC-009 O-4).
   */
  readonly emptyOptionLabel?: string;
  /**
   * A teszt hívása; `undefined`, ha nincs szolgáltató (a `ProviderOptionsContext`
   * alapértéke): a gomb ilyenkor tiltott.
   */
  readonly testConnection: ProviderConnectionTester | undefined;
}

/**
 * A kapcsolat teszt eredményének jelzése a design system `Alert` blokkjával
 * (SPEC-009 3.2): siker `success`, sikertelen teszt vagy a hívás hibája
 * `danger`. A sikertelen teszt `errorMessage` mezője a motor szövege
 * (`ConnectionTestResult`): a motor saját magyar mondata (hiányzó env, hiányzó
 * vagy nem `success` result), de az SDK vagy a folyam olvasása közben dobott
 * kivétel szövege is lehet (`describeError`), ezért nyers, nem feltétlenül
 * magyar szöveg; a megjelenítése termékdöntésre vár (SPEC-009 14.9 O-55). A
 * hívás hibája a REST réteg magyar mondata.
 */
function renderTestResult(state: RequestState<ConnectionTestResponse>): ReactElement | undefined {
  if (state.status === 'failure') {
    return <Alert variant="danger">{state.message}</Alert>;
  }
  if (state.status === 'success') {
    return state.value.succeeded ? (
      <Alert variant="success">A kapcsolat teszt sikeres.</Alert>
    ) : (
      <Alert variant="danger" title="A kapcsolat teszt sikertelen">
        {state.value.errorMessage ?? undefined}
      </Alert>
    );
  }
  // `idle` és `pending`: nincs még eredmény, a várakozást a gomb jelzi.
  return undefined;
}

/**
 * A provider választó a "Kapcsolat teszt" gombbal (SPEC-009 3.2, O-2): a
 * `SelectField` alatt `sm` méretű gomb, ami a kiválasztott providert
 * teszteli. Örökölt (üres) választásnál a gomb tiltott, és a tiltás oka
 * látszik. A teszt futása alatt a gomb `isLoading` állapotú; az eredmény
 * csak ahhoz a providerhez tartozik, amelyiken a teszt futott, a választás
 * váltása elrejti. A futó teszt alatt a gomb tiltott, tehát két teszt nem
 * versenyezhet egymással. Tesztelő nélkül (`testConnection` `undefined`) a
 * gomb szintén tiltott.
 */
export function ProviderSelect(properties: Readonly<ProviderSelectProperties>): ReactElement {
  const { providers, value, onChange, emptyOptionLabel, testConnection, ...selectProperties } = properties;
  const reasonId = useId();
  const testRequest = useRequestState<ConnectionTestResponse>();
  const [testedProviderId, setTestedProviderId] = useState<string | undefined>(undefined);

  const isInherited = value === '';
  const isTesting = testRequest.state.status === 'pending';
  const isTestOfSelection = testedProviderId === value;

  // A `&&` szűkíti a tesztelőt, ág nélkül: tesztelő nélkül nincs kezelő, és a
  // gomb a `disabled` miatt úgysem kattintható.
  const handleTest =
    testConnection &&
    ((): void => {
      setTestedProviderId(value);
      void testRequest.run(() => testConnection(value));
    });

  const options = providers.map((provider) => ({ value: provider.id, label: provider.displayName }));

  return (
    <div className="provider-select">
      <SelectField
        {...selectProperties}
        options={emptyOptionLabel === undefined ? options : [{ value: '', label: emptyOptionLabel }, ...options]}
        value={value}
        onChange={onChange}
      />
      <div className="provider-select__test">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isInherited || isTesting || selectProperties.loading === true || handleTest === undefined}
          isLoading={isTesting && isTestOfSelection}
          {...(isInherited && { 'aria-describedby': reasonId })}
          onClick={handleTest}
        >
          Kapcsolat teszt
        </Button>
        {isInherited && (
          <span id={reasonId} className="provider-select__reason">
            A kapcsolat teszthez válassz ki egy providert.
          </span>
        )}
      </div>
      {isTestOfSelection && renderTestResult(testRequest.state)}
    </div>
  );
}
