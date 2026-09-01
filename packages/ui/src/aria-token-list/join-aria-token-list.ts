/**
 * ARIA id-hivatkozás lista (`aria-describedby`, `aria-labelledby`)
 * összefűzése: a `undefined` elemek kiesnek, a többi szóköz mentén
 * feldarabolódik, a duplikátumok eltűnnek, üres lista helyett pedig
 * `undefined` jön vissza, hogy az attribútum ki se kerüljön a DOM-ba.
 *
 * Azért kell, mert a hívó saját hivatkozását nem szabad felülírni:
 * a komponens belső azonosítója (hibaüzenet, alcím) a hívóé MELLÉ kerül.
 * A design system forrás komponensei ugyanezt a mintát használják
 * (`Input.jsx`, `Modal.jsx`, `FormControls.jsx`).
 */
export function joinAriaTokenList(...values: readonly (string | undefined)[]): string | undefined {
  const tokens = values
    .filter((value): value is string => value !== undefined)
    .flatMap((value) => value.split(/\s+/))
    .filter((token) => token.length > 0);
  return tokens.length === 0 ? undefined : [...new Set(tokens)].join(' ');
}
