/**
 * A `workflow-language` csomag hibamondatát a szerkesztő írásmódjára alakítja
 * (SPEC-010 10., 15. O-19, user döntés 2026-10-25): nagy kezdőbetűvel és
 * ponttal zárva jelenik meg. Az előfeltételt a csomag vállalja és teszttel őrzi
 * (`error-sentence-form`): a `compile` mondata nem üres és nem zárul ponttal,
 * ezért itt nincs üres és nincs "már ponttal zárul" ág. A csomag mondata
 * változatlan, mert a szerver üzenetében a mondat közepén áll, kisbetűvel.
 */
export function toEditorSentence(message: string): string {
  return `${message.charAt(0).toLocaleUpperCase('hu')}${message.slice(1)}.`;
}
