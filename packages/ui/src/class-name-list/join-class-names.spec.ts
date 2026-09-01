import { describe, expect, it } from 'vitest';
import { joinClassNames } from './join-class-names.ts';

describe('joinClassNames', () => {
  it('szóközzel fűzi össze a nem üres string elemeket', () => {
    expect(joinClassNames('btn', 'btn--primary')).toBe('btn btn--primary');
  });

  it('kihagyja a false és az undefined elemeket', () => {
    expect(joinClassNames('btn', false, undefined, 'btn--lg')).toBe('btn btn--lg');
  });

  it('kihagyja az üres string elemet', () => {
    expect(joinClassNames('btn', '', 'btn--sm')).toBe('btn btn--sm');
  });

  it('üres bemenetre üres stringet ad', () => {
    expect(joinClassNames()).toBe('');
  });

  it('csupa kiesett elemre üres stringet ad', () => {
    expect(joinClassNames(false, undefined, '')).toBe('');
  });
});
