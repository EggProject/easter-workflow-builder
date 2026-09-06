import { useContext, useMemo, type ReactElement, type ReactNode } from 'react';
import { FieldErrorsContext } from './field-errors-context.ts';
import { scopeFieldErrors } from './scope-field-errors.ts';

export interface ScopedFieldErrorsProperties {
  /**
   * A beágyazott objektum mezőneve a szülő `config`-on belül (pl. `settings`).
   */
  readonly prefix: string;
  readonly children: ReactNode;
}

/**
 * A hibatérképet a `prefix` mező alá szűkítve adja tovább a gyerekeinek, hogy
 * egy beágyazott alakot szerkesztő komponens a SAJÁT, gyökértől számított
 * útvonalain kereshesse a hibáit (`scope-field-errors.ts`).
 */
export function ScopedFieldErrors(properties: Readonly<ScopedFieldErrorsProperties>): ReactElement {
  const { prefix, children } = properties;
  const errors = useContext(FieldErrorsContext);
  const scoped = useMemo(() => scopeFieldErrors(errors, prefix), [errors, prefix]);

  return <FieldErrorsContext.Provider value={scoped}>{children}</FieldErrorsContext.Provider>;
}
