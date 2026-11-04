import type { BinaryRequestBody } from '../route-dispatch/binary-route-handler.ts';

/**
 * A kérés nyers bináris törzsét olvassa be, legfeljebb `maxBytes` bájtig
 * (SPEC-009 5.4 6. pont, O-36; a `readJsonRequestBody` mintájára
 * `AsyncIterable<unknown>` bemenettel, `as` nélkül). A korlát túllépése után a
 * további bájtokat nem tartja meg, de a törzset végigolvassa, hogy a kliens a
 * hibaválaszt egy félbeszakított kapcsolat helyett megkapja; a memória így a
 * korlátnál nem nő tovább. A pontosan `maxBytes` hosszú törzs még elfogadott.
 */
export async function readBinaryRequestBody(
  source: AsyncIterable<unknown>,
  maxBytes: number,
): Promise<BinaryRequestBody> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of source) {
    if (!Buffer.isBuffer(chunk)) {
      continue;
    }

    totalBytes += chunk.length;
    if (totalBytes <= maxBytes) {
      chunks.push(chunk);
    }
  }
  return totalBytes > maxBytes ? { kind: 'too_large' } : { kind: 'complete', bytes: Buffer.concat(chunks) };
}
