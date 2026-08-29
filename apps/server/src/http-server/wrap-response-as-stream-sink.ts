import type { ServerResponse } from 'node:http';
import type { StreamSink } from '../stream-connection/stream-sink.ts';

/**
 * A `ServerResponse` becsomagolása a `StreamSink` alakba (SPEC-006 10.3 2.
 * pont: "A `ServerResponse` becsomagolása a nyelő alakjába a `http-server`
 * téma egyetlen, önállóan tesztelt függvénye"). A hívó felelőssége a válasz
 * fejléceinek beállítása és a `flushHeaders()` hívás az első keret előtt
 * (`create-http-server.ts`).
 */
export function wrapResponseAsStreamSink(response: ServerResponse): StreamSink {
  return {
    write: (chunk) => {
      response.write(chunk);
    },
    close: () => {
      response.end();
    },
  };
}
