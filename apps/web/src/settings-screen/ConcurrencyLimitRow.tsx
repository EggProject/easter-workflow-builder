import type { ConcurrencyLimitView } from '@easter-workflow-builder/protocol';
import { Alert, Button, FieldErrorVisibilityContext, TextField } from '@easter-workflow-builder/ui';
import { useId, useState, type ChangeEvent, type ReactElement, type SubmitEvent } from 'react';
import { useRequestState } from '../request-state/use-request-state.ts';
import type { RouteOutcome } from '../rest-client/route-outcome.ts';
import { parseConcurrencyLimitDraft } from './parse-concurrency-limit-draft.ts';

export interface ConcurrencyLimitRowProperties {
  readonly limit: ConcurrencyLimitView;
  /**
   * A provider megjelenített neve (`ProviderSummary.displayName`).
   */
  readonly providerName: string;
  readonly saveLimit: (providerId: string, maxConcurrentSteps: number) => Promise<RouteOutcome<ConcurrencyLimitView>>;
  readonly clearLimit: (providerId: string) => Promise<RouteOutcome<undefined>>;
}

const INVALID_DRAFT_MESSAGE = 'Pozitív egész számot adj meg.';

function describeConfiguredLimit(limit: ConcurrencyLimitView): string {
  return limit.configuredMaxConcurrentSteps === null
    ? 'Nincs beállított párhuzamossági korlát.'
    : `Beállított korlát: ${String(limit.configuredMaxConcurrentSteps)} egyszerre futó agent lépés.`;
}

/**
 * A javaslat a leíró mért értékéből jön, a megjegyzésével együtt; sosem lép
 * érvénybe, amíg a felhasználó el nem menti (SPEC-005 4.2 E táblázat).
 */
function describeSuggestion(suggestion: ConcurrencyLimitView['suggestion']): string {
  return suggestion.suggestedLimit === null
    ? `Nincs javaslat. ${suggestion.note}`
    : `Javaslat: ${String(suggestion.suggestedLimit)} egyszerre futó agent lépés. ${suggestion.note}`;
}

/**
 * Egy provider sora a "Párhuzamossági korlát" kártyán (SPEC-009 3.1 2. pont,
 * O-6): a beállított érték vagy a "nincs beállított" szöveg, a javaslat a
 * megjegyzésével, egy szám mező, és külön "Mentés" és "Korlát törlése" gomb.
 *
 * **A mező üresen indul, alapérték nincs** (`.claude/CLAUDE.md` 4. szekció 1.
 * pont, AC6): a beállított korlát csak a szövegben látszik, a mező minden
 * mentés után újra üres. A hibaüzenet a mező alatt áll (11. szekció): érintett
 * és érvénytelen, vagy már volt sikertelen mentési kísérlet és érvénytelen
 * (nem pozitív egész); érvénytelen értékre a `PUT` nem megy ki. A sikeres
 * mentés után a mező új kulccsal újra épül, hogy az "érintett" jelzése is
 * törlődjön, különben az üres mező azonnal hibát mutatna.
 *
 * A "Korlát törlése" csak beállított korlátnál él (nincs mit törölni
 * egyébként). Mindkét művelet alatt mindkét gomb tiltott, a futó művelet
 * gombja `isLoading` állapotú; a REST hiba danger `Alert` a sorban.
 */
export function ConcurrencyLimitRow(properties: Readonly<ConcurrencyLimitRowProperties>): ReactElement {
  const { limit, providerName, saveLimit, clearLimit } = properties;
  const titleId = useId();
  const [draft, setDraft] = useState('');
  const [isSubmitAttempted, setIsSubmitAttempted] = useState(false);
  const [fieldGeneration, setFieldGeneration] = useState(0);
  const saveRequest = useRequestState<ConcurrencyLimitView>();
  const clearRequest = useRequestState<undefined>();

  const parsedDraft = parseConcurrencyLimitDraft(draft);
  const isSaving = saveRequest.state.status === 'pending';
  const isClearing = clearRequest.state.status === 'pending';
  const isBusy = isSaving || isClearing;

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (parsedDraft === undefined) {
      setIsSubmitAttempted(true);
      return;
    }
    clearRequest.reset();
    void saveRequest.run(async () => {
      const outcome = await saveLimit(limit.providerId, parsedDraft);
      if (outcome.kind === 'ok') {
        setDraft('');
        setIsSubmitAttempted(false);
        setFieldGeneration((generation) => generation + 1);
      }
      return outcome;
    });
  }

  function handleClear(): void {
    saveRequest.reset();
    void clearRequest.run(() => clearLimit(limit.providerId));
  }

  return (
    <div className="preference-row concurrency-limit-row" role="group" aria-labelledby={titleId}>
      <div className="preference-row__body">
        <span className="preference-row__title" id={titleId}>
          {providerName}
        </span>
        <span className="settings-screen__hint">{describeConfiguredLimit(limit)}</span>
        <span className="settings-screen__hint">{describeSuggestion(limit.suggestion)}</span>
        {saveRequest.state.status === 'failure' && <Alert variant="danger">{saveRequest.state.message}</Alert>}
        {clearRequest.state.status === 'failure' && <Alert variant="danger">{clearRequest.state.message}</Alert>}
      </div>
      <FieldErrorVisibilityContext.Provider value={isSubmitAttempted}>
        {/* `noValidate`: a beküldés ellenőrzése a saját szabályon megy (a
            hibaüzenet a MEZŐ ALATT áll, 11. szekció); enélkül a böngésző natív
            `min`/`step` ellenőrzése a `submit` előtt megállítaná a beküldést. */}
        <form className="concurrency-limit-row__form" noValidate onSubmit={handleSubmit}>
          <TextField
            key={fieldGeneration}
            size="sm"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            aria-label={`Egyszerre futó agent lépések száma: ${providerName}`}
            value={draft}
            error={parsedDraft === undefined ? INVALID_DRAFT_MESSAGE : undefined}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              setDraft(event.target.value);
            }}
          />
          <Button type="submit" size="sm" isLoading={isSaving} disabled={isBusy}>
            Mentés
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            isLoading={isClearing}
            disabled={isBusy || limit.configuredMaxConcurrentSteps === null}
            onClick={handleClear}
          >
            Korlát törlése
          </Button>
        </form>
      </FieldErrorVisibilityContext.Provider>
    </div>
  );
}
