import { describe, expect, it } from 'vitest';
import { isInsideMenu } from './is-inside-menu.ts';

interface MenuTree {
  readonly anchor: HTMLElement;
  readonly panel: HTMLElement;
  readonly inside: HTMLElement;
  readonly outside: HTMLElement;
}

function buildTree(): MenuTree {
  const anchor = document.createElement('span');
  const panel = document.createElement('div');
  const inside = document.createElement('button');
  const outside = document.createElement('button');
  panel.append(inside);
  document.body.append(anchor, panel, outside);
  return { anchor, panel, inside, outside };
}

describe('isInsideMenu', () => {
  it('igaz, ha a cél az anchor leszármazottja', () => {
    const { anchor, panel } = buildTree();
    const child = document.createElement('button');
    anchor.append(child);

    expect(isInsideMenu(anchor, panel, child)).toBe(true);
  });

  it('igaz, ha a cél a panel leszármazottja', () => {
    const { anchor, panel, inside } = buildTree();

    expect(isInsideMenu(anchor, panel, inside)).toBe(true);
  });

  it('hamis, ha a cél mindkettőn kívül van', () => {
    const { anchor, panel, outside } = buildTree();

    expect(isInsideMenu(anchor, panel, outside)).toBe(false);
  });

  it('hamis, ha a cél nem DOM csomópont', () => {
    const { anchor, panel } = buildTree();

    expect(isInsideMenu(anchor, panel, new EventTarget())).toBe(false);
  });

  it('hamis, ha sem az anchor, sem a panel nincs csatolva', () => {
    const { outside } = buildTree();
    // A `RefObject.current` üres állapota a DOM API-ban `null`, a függvény
    // pont ezt az ágat kezeli.
    // eslint-disable-next-line unicorn/no-null
    expect(isInsideMenu(null, null, outside)).toBe(false);
  });
});
