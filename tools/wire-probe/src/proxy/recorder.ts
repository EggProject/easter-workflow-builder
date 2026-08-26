/**
 * Tranzakció-rögzítő: minden proxyn átment HTTP tranzakciót egy önálló,
 * maszkolt JSON fájlba ír az artefaktum könyvtárba, monoton sorszámmal.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { maskHeaders, redactKnownSecrets } from './mask.ts';
import type { RecordedTransaction } from './types.ts';

/** Egy rögzítendő tranzakció, sorszám nélkül -- azt a recorder osztja ki. */
export type TransactionInput = Omit<RecordedTransaction, 'seq'>;

export class TransactionRecorder {
  readonly #artifactsDir: string;
  readonly #secrets: readonly string[];
  #seq = 0;

  constructor(artifactsDir: string, secrets: readonly string[]) {
    this.#artifactsDir = artifactsDir;
    this.#secrets = secrets;
    mkdirSync(artifactsDir, { recursive: true });
  }

  /** Eddig rögzített tranzakciók száma. */
  get count(): number {
    return this.#seq;
  }

  get artifactsDir(): string {
    return this.#artifactsDir;
  }

  /**
   * Egy tranzakció lemezre írása. A headereket névalapon maszkolja, majd a
   * teljes szerializált szöveget még egyszer átfésüli az ismert titkokra,
   * mielőtt bármi lemezre kerülne.
   */
  record(input: TransactionInput): void {
    this.#seq += 1;
    const transaction: RecordedTransaction = {
      seq: this.#seq,
      ...input,
      requestHeaders: maskHeaders(input.requestHeaders),
      responseHeaders: maskHeaders(input.responseHeaders),
    };
    const rawJson = JSON.stringify(transaction, null, 2);
    const safeJson = redactKnownSecrets(rawJson, this.#secrets);
    const fileName = `${String(this.#seq).padStart(5, '0')}-${Date.now()}.json`;
    writeFileSync(join(this.#artifactsDir, fileName), safeJson, 'utf8');
  }
}
