import type { ProtocolErrorCode } from '@easter-workflow-builder/protocol';
import { describe, expect, it } from 'vitest';
import { protocolErrorMessage } from './protocol-error-message.ts';

describe('protocolErrorMessage', () => {
  const cases: readonly (readonly [ProtocolErrorCode, string])[] = [
    ['invalid_request', 'A kérés nem volt érvényes.'],
    ['not_found', 'A keresett elem nem létezik, esetleg időközben törölték.'],
    ['conflict', 'Az elem állapota most nem engedi a műveletet.'],
    ['unprocessable', 'A kérés rendben volt, de a rendszer nem tudja végrehajtani.'],
    ['internal', 'Váratlan szerver hiba történt.'],
    ['service_unavailable', 'A szerver átmenetileg nem érhető el, például éppen leáll.'],
  ];

  it.each(cases)('a(z) "%s" kódhoz a megfelelő magyar mondatot rendeli', (code, expected) => {
    expect(protocolErrorMessage(code)).toBe(expected);
  });

  // A mondat önállóan áll a felületen (user döntés 2026-09-24, SPEC-007 8.4):
  // egyetlen záró pont, kettőspont nélkül, tehát semmi nem fűzhető utána
  // ".:" alakban.
  it.each(cases)('a(z) "%s" kód mondata egyetlen záró ponttal végződik, kettőspont nélkül', (code) => {
    expect(protocolErrorMessage(code)).toMatch(/^[^.:]+\.$/u);
  });
});
