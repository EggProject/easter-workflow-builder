import Mustache from 'mustache';
import { describe, expect, it } from 'vitest';
import { MissingTemplateNameError } from './missing-template-name-error.ts';
import { NonJsonTemplateValueError } from './non-json-template-value-error.ts';
import { OwnPropertyContext } from './own-property-context.ts';
import { StrictWriter } from './strict-writer.ts';

describe('StrictWriter', () => {
  it('a saját gyorsítótára ki van kapcsolva', () => {
    const writer = new StrictWriter();
    expect(writer.templateCache).toBeUndefined();
    expect(writer.parse('{{a}}')).not.toBe(writer.parse('{{a}}'));
  });

  it('kontrollként: egy gyári Writer példány gyorsítótáraz', () => {
    const stockWriter = new Mustache.Writer();
    expect(stockWriter.parse('{{a}}')).toBe(stockWriter.parse('{{a}}'));
  });

  it('a három változó alak escape nélkül, szöveggé alakítva ír', () => {
    const writer = new StrictWriter();
    expect(writer.render('{{a}}|{{{a}}}|{{& a}}', new OwnPropertyContext({ a: ['<', 1] }))).toBe(
      '["<",1]|["<",1]|["<",1]',
    );
  });

  it('a sima változó tag hiányzó neve MissingTemplateNameError', () => {
    const writer = new StrictWriter();
    expect(() => writer.render('{{nincs}}', new OwnPropertyContext({}))).toThrow(MissingTemplateNameError);
    expect(() => writer.render('{{{nincs}}}', new OwnPropertyContext({}))).toThrow(MissingTemplateNameError);
  });

  it('a nem JSON értékre mutató név NonJsonTemplateValueError', () => {
    const writer = new StrictWriter();
    expect(() => writer.render('{{v}}', new OwnPropertyContext({ v: new Map() }))).toThrow(NonJsonTemplateValueError);
    expect(() => writer.render('{{& v}}', new OwnPropertyContext({ v: 1n }))).toThrow(NonJsonTemplateValueError);
  });

  it('a szakasz és a fordított szakasz hiányzó névvel hiba nélküli', () => {
    const writer = new StrictWriter();
    expect(writer.render('{{#nincs}}x{{/nincs}}{{^nincs}}y{{/nincs}}', new OwnPropertyContext({}))).toBe('y');
  });
});
