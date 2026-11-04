/**
 * A `Switch` hozzáférhető nevének és leírásának bekötése. A `hint` a
 * burkoló `<label>` belsejében áll, ezért önmagában belekerülne az implicit
 * névbe; az `aria-labelledby` a főcímke span-ra mutat (ez a legmagasabb
 * prioritású névforrás), a `hint` pedig leírásként az `aria-describedby`
 * mezőbe kerül. A forrás `useControlAria` hook-ja, a `useId` hívás nélkül
 * (azt a komponens végzi, hogy a hook sorrend stabil maradjon).
 */
export interface SwitchAriaInput {
  readonly labelId: string;
  readonly hintId: string;
  readonly hasLabel: boolean;
  readonly hasHint: boolean;
  readonly ariaLabelledBy: string | undefined;
  readonly ariaDescribedBy: string | undefined;
}

export interface SwitchAria {
  readonly labelledBy: string | undefined;
  readonly describedBy: string | undefined;
}

export function resolveSwitchAria(input: SwitchAriaInput): SwitchAria {
  const { labelId, hintId, hasLabel, hasHint, ariaLabelledBy, ariaDescribedBy } = input;
  // A hívó aria-labelledby értéke erősebb, ha nem üres; különben a generált címke azonosító.
  const labelledBy = ariaLabelledBy !== undefined && ariaLabelledBy !== '' ? ariaLabelledBy : undefined;
  const describedByTokens = `${ariaDescribedBy ?? ''} ${hasHint ? hintId : ''}`
    .trim()
    .split(/\s+/)
    .filter((token) => token !== '');
  return {
    labelledBy: labelledBy ?? (hasLabel ? labelId : undefined),
    describedBy: describedByTokens.length > 0 ? [...new Set(describedByTokens)].join(' ') : undefined,
  };
}
