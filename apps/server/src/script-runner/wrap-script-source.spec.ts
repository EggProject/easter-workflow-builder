import { describe, expect, it } from 'vitest';
import { wrapScriptSource } from './wrap-script-source.ts';

describe('wrapScriptSource', () => {
  it('a törzset külön sorban, azonnal hívott async nyílfüggvénybe csomagolja', () => {
    expect(wrapScriptSource('return 1;')).toBe('(async () => {\nreturn 1;\n})()');
  });
});
