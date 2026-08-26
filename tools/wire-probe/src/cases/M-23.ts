/**
 * M-23: kép bemenet felismerhető tartalommal -- az M-16 kiegészítése (nyitva
 * maradt kérdés, kiértékelés 3. szekció 5. pont). Az M-16 egy érvénytelenül
 * kicsi (1x1 pixeles) PNG-t küldött, ebből nem dönthető el, hogy a MiniMax
 * eldobta-e a képet, vagy a modell egy egypixeles képről nem tud mit
 * mondani. Ez a case programozottan generál egy legalább 256x256 pixeles,
 * egyszínű (tiszta piros) PNG-t, és megkérdezi a modellt, milyen színt lát.
 */
import { crc32, deflateSync } from 'node:zlib';
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, executeQuery } from '../harness/runner.ts';

const IMAGE_SIZE = 256;
/** Tiszta piros, RGB. */
const SOLID_COLOR: readonly [number, number, number] = [255, 0, 0];

function u32be(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0, 0);
  return b;
}

/** Egy PNG chunk: hossz + típus + adat + CRC32(típus+adat), a PNG specifikáció szerint. */
function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = crc32(Buffer.concat([typeBuf, data]));
  return Buffer.concat([u32be(data.length), typeBuf, data, u32be(crc)]);
}

/** Egyszínű, 8 bites truecolor (colortype 2), tömörítés nélküli szűrésű PNG felépítése a fájlrendszer megkerülésével. */
function buildSolidColorPng(width: number, height: number, rgb: readonly [number, number, number]): Buffer {
  const [r, g, b] = rgb;
  const rowBytes = 1 + width * 3;
  const raw = Buffer.alloc(rowBytes * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * rowBytes;
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const px = rowStart + 1 + x * 3;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
    }
  }
  const compressed = deflateSync(raw);

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.concat([u32be(width), u32be(height), Buffer.from([8, 2, 0, 0, 0])]);
  const ihdr = pngChunk('IHDR', ihdrData);
  const idat = pngChunk('IDAT', compressed);
  const iend = pngChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([signature, ihdr, idat, iend]);
}

const RED_PNG_BASE64 = buildSolidColorPng(IMAGE_SIZE, IMAGE_SIZE, SOLID_COLOR).toString('base64');

async function* imagePrompt(): AsyncGenerator<SDKUserMessage> {
  yield {
    type: 'user',
    message: {
      role: 'user',
      content: [
        { type: 'text', text: 'Milyen színű ez a kép? Egyetlen szóval válaszolj.' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: RED_PNG_BASE64 } },
      ],
    },
    parent_tool_use_id: null,
  };
}

export const M23: MeasurementCase = {
  id: 'M-23',
  title: 'Kép bemenet felismerhető tartalommal',
  question: 'M-16 kiegészítés (nyitva maradt kérdés, kiértékelés 3. szekció 5. pont)',
  async run(ctx) {
    const outcome = await executeQuery({
      ctx,
      caseId: 'M-23',
      runId: 'a',
      prompt: imagePrompt(),
      options: buildBaseOptions(ctx),
    });
    return [outcome];
  },
};
