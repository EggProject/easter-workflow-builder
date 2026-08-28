/**
 * A kimenő esemény port (SPEC-004 3.2 táblázat, `eventPublisher` sor): a
 * motor minden agent lépés üzenetnél ide adja tovább az élő WebSocket
 * nézetnek szánt eseményt, miután a `db` felé már hozzáfűzte (SPEC-004 5.2, 6.
 * pont). A `publish` szándékosan `unknown` bemenetű: a payload alakja a motor
 * `engine-event` témájában dől el, a port maga nem szűkíti.
 */
export interface EventPublisherPort {
  publish(event: unknown): void;
}
