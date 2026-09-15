/**
 * Egy mező hibaüzenete a panel hibatérképéből.
 *
 * A mező PONTOS útvonala mellett a mező ALATTI útvonalakat is elfogadja: ez
 * azokhoz a vezérlőkhöz kell, amik egy egész gyűjteményt szerkesztenek
 * egyetlen mezőben (a `backoffMs` és a `handledErrorKinds` soronkénti
 * listája, az `inputMapping` kulcs-érték listája). Ott a Zod a HIBÁS ELEM
 * útvonalán jelez (`backoffMs.1`), a felhasználó viszont egyetlen mezőt lát,
 * tehát a hibaüzenetnek ott kell megjelennie.
 *
 * A két esetet SZÁNDÉKOSAN egyetlen bejárás fedi, nem egy `Map.get` gyorsút
 * és utána egy bejárás: a térkép legfeljebb néhány elemű (egy node
 * `config`-jának hibái), a gyorsút tehát nem mér semmit, viszont egy külön
 * ágat hozna. Az előtag egyezés pontnál vág, tehát az `effort` mező nem
 * szedi fel egy `effortLimit` nevű mező hibáját.
 */
export function findFieldError(errors: ReadonlyMap<string, string>, path: string): string | undefined {
  const prefix = `${path}.`;
  for (const [candidate, message] of errors) {
    if (candidate === path || candidate.startsWith(prefix)) {
      return message;
    }
  }
  return undefined;
}
