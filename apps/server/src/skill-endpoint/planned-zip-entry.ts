/**
 * Egy elfogadott zip bejegyzés útvonala és típusa, a záró `/` nélkül. Típus
 * only fájl, a kicsomagolás tervezési lépései közös bemenete.
 */
export interface PlannedZipEntry {
  readonly path: string;
  readonly kind: 'file' | 'directory';
}
