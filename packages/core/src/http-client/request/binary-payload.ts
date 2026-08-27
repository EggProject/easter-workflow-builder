/**
Letöltött bináris tartalom a hozzá tartozó, szerver által jelentett típussal.
*/
export interface BinaryPayload {
  readonly bytes: Uint8Array;
  readonly contentType: string;
}
