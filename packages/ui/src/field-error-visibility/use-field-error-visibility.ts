import { useContext, useState } from 'react';
import { FieldErrorVisibilityContext } from './field-error-visibility-context.ts';

export interface FieldErrorVisibility {
  /**
   * Ki kell-e írni a hibaüzenetet, és hibás állapotba kell-e állítani a
   * mezőt (`aria-invalid`, hibás szegély, `aria-describedby`).
   */
  readonly isErrorVisible: boolean;
  /**
   * A mező elhagyásakor (`blur`) hívandó: innentől a mező "érintett".
   */
  readonly markTouched: () => void;
}

/**
 * A hibaüzenet megjelenési szabálya, egy helyen, mind a három mezőnek
 * (`TextField`, `SelectField`, `TextAreaField`).
 *
 * A SZABÁLY: a hibaüzenet akkor látszik, ha a mező **érintett és
 * érvénytelen**, VAGY ha az űrlapot már **legalább egyszer megpróbálták
 * beküldeni** (`FieldErrorVisibilityContext`) **és a mező érvénytelen**.
 * Érintetlen mezőn tehát nincs hibaüzenet akkor sem, ha az értéke
 * érvénytelen - a felhasználót nem szidjuk le olyasmiért, amihez még hozzá
 * sem nyúlt.
 *
 * MIÉRT ÍGY, HOZZÁFÉRHETŐSÉGI OLDALRÓL. A hívó mező az `isErrorVisible`
 * értéket használja az `aria-invalid` kitételéhez is, nem csak a látható
 * üzenethez. Ezt a WCAG 2.2 ARIA21 technika írja elő szó szerint: "The
 * aria-invalid attribute should not be set to 'true' before input
 * validation is performed", és "Setting aria-invalid to 'false' is the same
 * as not placing the attribute for the form control"
 * (<https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA21>). A megjelenő
 * üzenet és a mező összekötése `aria-describedby`, a W3C WAI Forms
 * Tutorial "User Notifications" szerint: "form fields can be associated
 * with the corresponding error message using aria-describedby"
 * (<https://www.w3.org/WAI/tutorials/forms/notifications/>). Ugyanez a
 * tutorial nevezi meg a MEGJELENÉS eljuttatásának módját is: a hibaüzenet
 * konténere `role="alert"` szerepet kap, ezért a mezők a hibaüzenetet ebben
 * a szerepben rajzolják ki.
 *
 * NEM MEGERŐSÍTETT, ezért nem is állítjuk: arra, hogy a hibaüzenetnek
 * PONTOSAN MIKOR kell megjelennie (gépelés közben, elhagyáskor vagy csak
 * beküldéskor), a WAI-nak nincs kötelező előírása - a WCAG 3.3.1
 * Understanding lapja kimondja, hogy "This criterion does not mandate any
 * particular way in which errors should be displayed"
 * (<https://www.w3.org/WAI/WCAG22/Understanding/error-identification>). A
 * fenti szabály tehát felhasználói termékdöntés, amit a hivatalos anyagok
 * megengednek, nem egy hivatkozott előírás.
 */
export function useFieldErrorVisibility(error: string | undefined): FieldErrorVisibility {
  const isSubmitAttempted = useContext(FieldErrorVisibilityContext);
  const [isTouched, setIsTouched] = useState(false);

  return {
    isErrorVisible: error !== undefined && (isTouched || isSubmitAttempted),
    markTouched: () => {
      setIsTouched(true);
    },
  };
}
