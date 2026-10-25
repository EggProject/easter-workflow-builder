/**
 * A `workflow-language` csomag hibamondatát a szerkesztő írásmódjára alakítja
 * (SPEC-010 10., 15. O-17, user döntés 2026-10-25): nagy kezdőbetűvel és
 * ponttal zárva jelenik meg. A csomag maga változatlan, mert a szerver
 * üzenetében a mondat közepén áll, kisbetűvel. Ha a mondat már ponttal
 * zárul, nem kerül rá második pont; az üres szöveg üres marad.
 */
export function toEditorSentence(message: string): string {
  if (message === '') {
    return message;
  }
  const capitalized = message.charAt(0).toLocaleUpperCase('hu') + message.slice(1);
  return capitalized.endsWith('.') ? capitalized : `${capitalized}.`;
}
