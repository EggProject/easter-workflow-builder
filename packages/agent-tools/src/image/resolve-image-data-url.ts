import { Buffer } from 'node:buffer';
import type { FetchFunction } from '../http/fetch-function.ts';
import { getBinary } from '../http/get-binary.ts';
import { describeError } from '../http/describe-error.ts';
import { isOkOutcome } from '../result/is-ok-outcome.ts';
import type { Outcome } from '../result/outcome.ts';
import type { ImageMediaType } from './image-media-type.ts';
import { mediaTypeFromContentType } from './media-type-from-content-type.ts';
import { mediaTypeFromExtension } from './media-type-from-extension.ts';
import type { ReadFileFunction } from './read-file-function.ts';

const SUPPORTED_FORMATS_HINT = 'Támogatott formátumok: JPEG, PNG, WebP.';

function toDataUrl(mediaType: ImageMediaType, bytes: Uint8Array): string {
  return `data:${mediaType};base64,${Buffer.from(bytes).toString('base64')}`;
}

/**
 * A kép forrásának feloldása base64 data URL alakra. Három bemenet lehetséges:
 * kész `data:image/...` URL, HTTP vagy HTTPS cím, illetve helyi fájl útvonal.
 *
 * A letöltés és a base64 kódolás azért kell, mert a mérésünk szerint a MiniMax
 * képértelmező végpontja a nyers HTTP címet elutasítja.
 */
export async function resolveImageDataUrl(
  imageSource: string,
  timeoutMs: number,
  fetchFunction: FetchFunction,
  readFileFunction: ReadFileFunction,
): Promise<Outcome<string>> {
  if (imageSource.startsWith('data:')) {
    if (!imageSource.startsWith('data:image/')) {
      return { kind: 'error', message: `A megadott data URL nem képet tartalmaz. ${SUPPORTED_FORMATS_HINT}` };
    }
    return { kind: 'ok', value: imageSource };
  }

  if (imageSource.startsWith('http://') || imageSource.startsWith('https://')) {
    const download = await getBinary(imageSource, timeoutMs, fetchFunction);
    if (!isOkOutcome(download)) {
      return download;
    }
    const mediaType = mediaTypeFromContentType(download.value.contentType);
    if (mediaType === undefined) {
      return {
        kind: 'error',
        message: `A(z) ${imageSource} cím "${download.value.contentType}" típust jelentett, ami nem támogatott kép. ${SUPPORTED_FORMATS_HINT}`,
      };
    }
    return { kind: 'ok', value: toDataUrl(mediaType, download.value.bytes) };
  }

  const mediaType = mediaTypeFromExtension(imageSource);
  if (mediaType === undefined) {
    return {
      kind: 'error',
      message: `A(z) ${imageSource} fájl kiterjesztése alapján nem támogatott kép. ${SUPPORTED_FORMATS_HINT}`,
    };
  }
  try {
    const bytes = await readFileFunction(imageSource);
    return { kind: 'ok', value: toDataUrl(mediaType, bytes) };
  } catch (error) {
    return { kind: 'error', message: `A(z) ${imageSource} fájl nem olvasható: ${describeError(error)}` };
  }
}
