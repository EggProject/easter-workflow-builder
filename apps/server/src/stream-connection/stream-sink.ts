/**
 * A stream válasz kimenő oldalának absztrakciója (SPEC-006 6.1 táblázat,
 * `stream-connection` sor, "a nyelő, a keret kiírás"; 10.3 2. pont: "a
 * stream nem `ServerResponse` objektumra ír, hanem egy `write(chunk)` és
 * `close()` metódusú nyelőre"). A `ServerResponse` becsomagolása ebbe az
 * alakba a `http-server` téma egyetlen, önállóan tesztelt függvénye
 * (`wrap-response-as-stream-sink.ts`); a teszt memóriabeli nyelőt ad.
 *
 * Típus-only fájl, nincs hozzá `.spec.ts`.
 */
export interface StreamSink {
  write(chunk: string): void;
  close(): void;
}
