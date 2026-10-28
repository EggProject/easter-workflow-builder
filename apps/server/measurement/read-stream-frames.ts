import { decodeStreamFrame, type StreamFrame } from '@easter-workflow-builder/protocol';

/**
Az SSE folyam kereteinek dekódolása a `data:` sorokból (SPEC-005 5.3).
*/
export async function* readStreamFrames(reader: ReadableStreamDefaultReader<string>): AsyncGenerator<StreamFrame> {
  let buffer = '';
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) {
      return;
    }
    buffer += chunk.value;
    let separator = buffer.indexOf('\n\n');
    while (separator !== -1) {
      const block = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      separator = buffer.indexOf('\n\n');
      const dataLine = block.split('\n').find((line) => line.startsWith('data: '));
      if (dataLine !== undefined) {
        const raw: unknown = JSON.parse(dataLine.slice('data: '.length));
        const decoded = decodeStreamFrame(raw);
        if (decoded.kind === 'error') {
          throw new Error(`Érvénytelen stream keret: ${decoded.message}`);
        }
        yield decoded.value;
      }
    }
  }
}
