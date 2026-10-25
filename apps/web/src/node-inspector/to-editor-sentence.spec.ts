import { describe, expect, it } from 'vitest';
import { toEditorSentence } from './to-editor-sentence.ts';

describe('toEditorSentence', () => {
  it('a sablon mondatát nagy kezdőbetűvel és ponttal zárja', () => {
    expect(toEditorSentence('le nem zárt szakasz a sablonban (pozíció: 10)')).toBe(
      'Le nem zárt szakasz a sablonban (pozíció: 10).',
    );
  });

  it('a kifejezés mondatát nagy kezdőbetűvel és ponttal zárja', () => {
    expect(toEditorSentence('nem deklarált változó a kifejezésben (pozíció: 0)')).toBe(
      'Nem deklarált változó a kifejezésben (pozíció: 0).',
    );
  });

  it('a pozíció nélküli mondatot is ponttal zárja', () => {
    expect(toEditorSentence('a sablon nem renderelhető')).toBe('A sablon nem renderelhető.');
  });

  it('az ékezetes kezdőbetűt is nagybetűre cseréli', () => {
    expect(toEditorSentence('érvénytelen időtartam a kifejezésben')).toBe('Érvénytelen időtartam a kifejezésben.');
  });

  it('a már nagybetűs mondatot nem változtatja a kezdőbetűn', () => {
    expect(toEditorSentence('A mező üres')).toBe('A mező üres.');
  });
});
