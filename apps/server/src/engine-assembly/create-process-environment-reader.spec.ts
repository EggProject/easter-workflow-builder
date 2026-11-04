import { afterEach, describe, expect, it } from 'vitest';
import { createProcessEnvironmentReader } from './create-process-environment-reader.ts';

const TEST_VARIABLE_NAME = 'EASTER_SERVER_TEST_ENV_VARIABLE';

describe('createProcessEnvironmentReader', () => {
  afterEach(() => {
    Reflect.deleteProperty(process.env, TEST_VARIABLE_NAME);
  });

  it('beállított env változóra a tényleges értéket adja', () => {
    process.env[TEST_VARIABLE_NAME] = 'érték';
    const reader = createProcessEnvironmentReader();
    expect(reader.read(TEST_VARIABLE_NAME)).toBe('érték');
  });

  it('hiányzó env változóra null-t ad', () => {
    const reader = createProcessEnvironmentReader();
    expect(reader.read(TEST_VARIABLE_NAME)).toBeNull();
  });

  it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf'])(
    'a prototípus lánc %s neve hiányzó változó: null (PLAN-012 T-012-27)',
    (name) => {
      const reader = createProcessEnvironmentReader();
      expect(reader.read(name)).toBeNull();
    },
  );

  it('az üres érték nem hiányzó: üres szöveget ad (SPEC-009 6.4)', () => {
    process.env[TEST_VARIABLE_NAME] = '';
    const reader = createProcessEnvironmentReader();
    expect(reader.read(TEST_VARIABLE_NAME)).toBe('');
  });

  it('a readAll a teljes környezet pillanatképe, a beállított változóval együtt', () => {
    process.env[TEST_VARIABLE_NAME] = 'érték';
    const snapshot = createProcessEnvironmentReader().readAll();
    expect(snapshot[TEST_VARIABLE_NAME]).toBe('érték');
    expect(new Set(Object.keys(snapshot))).toStrictEqual(new Set(Object.keys(process.env)));
  });

  it('a readAll pillanatkép: a későbbi env módosítás nem írja át a már kapott objektumot', () => {
    const snapshot = createProcessEnvironmentReader().readAll();
    process.env[TEST_VARIABLE_NAME] = 'később';
    expect(Object.hasOwn(snapshot, TEST_VARIABLE_NAME)).toBe(false);
  });
});
