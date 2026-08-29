import type { StreamFrame } from './stream-frame.ts';

/**
 * A keret drótszintű SSE szöveggé kódolása (SPEC-005 5.3, 5.4 szekció, 22.
 * és 23. kritérium). A menet:
 * - `event:` sor mindig, az `event` diszkriminátor értékével,
 * - `id:` sor **kizárólag** a `run_event` kereten, a beágyazott
 *   `runEvent.id` decimális alakjával (5.3: "az SSE `id:` mező értéke
 *   pontosan a `run_event.id` decimális alakja"); a másik négy keretnek
 *   nincs mögötte visszalapozható sor, ezért nem kap `id:` sort (5.4),
 * - a törzs pontosan egy `data:` sorban: a `JSON.stringify` a teljes
 *   kerettárgyat írja ki, a diszkriminátorral együtt, hogy a
 *   `decodeStreamFrame` közvetlenül a `StreamFrameSchema` ellen tudja
 *   validálni. Egy sor mindig elég, mert a `JSON.stringify` a
 *   U+0000 ... U+001F tartomány minden kódegységét escape-eli, tehát a
 *   payload esetleges sortörése sem hoz létre második sort (F-24),
 * - a keretet lezáró üres sor, a szabvány szerinti mezőelválasztó.
 */
export function encodeStreamFrame(frame: StreamFrame): string {
  const lines: string[] = [`event: ${frame.event}`];
  if (frame.event === 'run_event') {
    lines.push(`id: ${frame.runEvent.id.toString()}`);
  }
  lines.push(`data: ${JSON.stringify(frame)}`);
  return `${lines.join('\n')}\n\n`;
}
