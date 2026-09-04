import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Tabs, type TabItem } from './Tabs.tsx';

const ITEMS: readonly TabItem[] = [
  { id: 'all', label: 'Minden futás', count: 12, content: 'minden' },
  { id: 'one', label: 'Egy workflow futásai', content: 'egy' },
  { id: 'failed', label: 'Hibás futások', content: 'hibás' },
];

function pressKeyOn(tab: HTMLButtonElement, key: string): void {
  act(() => {
    tab.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

describe('Tabs', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function renderedTabs(): readonly HTMLButtonElement[] {
    return [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  }

  function renderedPanels(): readonly HTMLDivElement[] {
    return [...container.querySelectorAll<HTMLDivElement>('[role="tabpanel"]')];
  }

  function selectedTabLabels(): readonly string[] {
    return renderedTabs()
      .filter((tab) => tab.getAttribute('aria-selected') === 'true')
      .map((tab) => tab.textContent);
  }

  it('a tablist és a fülek a design system osztályaival rajzolódnak ki', () => {
    act(() => {
      root.render(<Tabs items={ITEMS} aria-label="Futás szűrők" />);
    });
    const tablist = container.querySelector('[role="tablist"]');
    expect(tablist?.className).toBe('tabs');
    expect(tablist?.getAttribute('aria-label')).toBe('Futás szűrők');
    expect(renderedTabs()).toHaveLength(3);
    expect(container.querySelector('.tabs__panels')).not.toBeNull();
  });

  it('a count pirula csak ott jelenik meg, ahol van érték', () => {
    act(() => {
      root.render(<Tabs items={ITEMS} />);
    });
    const counts = [...container.querySelectorAll('.tabs__count')];
    expect(counts).toHaveLength(1);
    expect(counts[0]?.textContent).toBe('12');
  });

  it('aria-labelledby hivatkozással is meg lehet nevezni a tablistet', () => {
    act(() => {
      root.render(<Tabs items={ITEMS} aria-labelledby="fejlec" />);
    });
    expect(container.querySelector('[role="tablist"]')?.getAttribute('aria-labelledby')).toBe('fejlec');
  });

  it('nem kontrollált mód: alapból az első fül aktív, roving tabindexszel', () => {
    act(() => {
      root.render(<Tabs items={ITEMS} />);
    });
    const tabs = renderedTabs();
    expect(tabs[0]?.className).toBe('is-on');
    expect(tabs[0]?.tabIndex).toBe(0);
    expect(tabs[1]?.tabIndex).toBe(-1);
    expect(selectedTabLabels()).toEqual(['Minden futás12']);
  });

  it('minden panel felcsatolva marad, csak az inaktívak rejtettek', () => {
    act(() => {
      root.render(<Tabs items={ITEMS} />);
    });
    const panels = renderedPanels();
    expect(panels).toHaveLength(3);
    expect(panels.map((panel) => panel.hidden)).toEqual([false, true, true]);
    expect(panels[0]?.textContent).toBe('minden');
    expect(panels[0]?.getAttribute('aria-labelledby')).toBe(renderedTabs()[0]?.id);
    expect(renderedTabs()[0]?.getAttribute('aria-controls')).toBe(panels[0]?.id);
  });

  it('nem kontrollált mód: kattintásra a komponens maga vált fület', () => {
    const changes: string[] = [];
    act(() => {
      root.render(
        <Tabs
          items={ITEMS}
          onChange={(id) => {
            changes.push(id);
          }}
        />,
      );
    });
    act(() => {
      renderedTabs()[1]?.click();
    });
    expect(changes).toEqual(['one']);
    expect(renderedPanels().map((panel) => panel.hidden)).toEqual([true, false, true]);
  });

  it('kontrollált mód: a hívó értéke dönt, a komponens nem vált magától', () => {
    const changes: string[] = [];
    act(() => {
      root.render(
        <Tabs
          items={ITEMS}
          active="failed"
          onChange={(id) => {
            changes.push(id);
          }}
        />,
      );
    });
    expect(renderedPanels().map((panel) => panel.hidden)).toEqual([true, true, false]);

    act(() => {
      renderedTabs()[0]?.click();
    });
    expect(changes).toEqual(['all']);
    expect(renderedPanels().map((panel) => panel.hidden)).toEqual([true, true, false]);

    act(() => {
      root.render(<Tabs items={ITEMS} active="all" />);
    });
    expect(renderedPanels().map((panel) => panel.hidden)).toEqual([false, true, true]);
  });

  it('ismeretlen kontrollált azonosító esetén az első fülre esik vissza', () => {
    const changes: string[] = [];
    act(() => {
      root.render(
        <Tabs
          items={ITEMS}
          active="nincs-ilyen"
          onChange={(id) => {
            changes.push(id);
          }}
        />,
      );
    });
    expect(renderedPanels().map((panel) => panel.hidden)).toEqual([false, true, true]);
    expect(changes).toEqual([]);
  });

  it('a kiválasztott fül eltűnésekor a nem kontrollált mód is az elsőre esik vissza', () => {
    act(() => {
      root.render(<Tabs items={ITEMS} />);
    });
    act(() => {
      renderedTabs()[2]?.click();
    });
    expect(renderedPanels().map((panel) => panel.hidden)).toEqual([true, true, false]);

    act(() => {
      root.render(<Tabs items={ITEMS.slice(0, 2)} />);
    });
    expect(renderedPanels().map((panel) => panel.hidden)).toEqual([false, true]);
  });

  it('a már aktív fülre kattintás nem hív onChange kezelőt', () => {
    const changes: string[] = [];
    act(() => {
      root.render(
        <Tabs
          items={ITEMS}
          onChange={(id) => {
            changes.push(id);
          }}
        />,
      );
    });
    act(() => {
      renderedTabs()[0]?.click();
    });
    expect(changes).toEqual([]);
  });

  it('onChange nélkül is vált fület', () => {
    act(() => {
      root.render(<Tabs items={ITEMS} />);
    });
    act(() => {
      renderedTabs()[1]?.click();
    });
    expect(renderedPanels().map((panel) => panel.hidden)).toEqual([true, false, true]);
  });

  it('üres lista esetén nincs fül és nincs panel', () => {
    act(() => {
      root.render(<Tabs items={[]} />);
    });
    expect(renderedTabs()).toHaveLength(0);
    expect(renderedPanels()).toHaveLength(0);
  });

  it('ArrowRight a következő fülre lép, és az utolsóról körbeér', () => {
    act(() => {
      root.render(<Tabs items={ITEMS} />);
    });
    const firstTab = renderedTabs()[0];
    if (firstTab === undefined) {
      throw new Error('nincs kirajzolt fül');
    }
    pressKeyOn(firstTab, 'ArrowRight');
    expect(renderedPanels().map((panel) => panel.hidden)).toEqual([true, false, true]);

    const lastTab = renderedTabs()[2];
    if (lastTab === undefined) {
      throw new Error('nincs kirajzolt fül');
    }
    pressKeyOn(lastTab, 'ArrowRight');
    expect(renderedPanels().map((panel) => panel.hidden)).toEqual([false, true, true]);
  });

  it('ArrowLeft az előző fülre lép, és az elsőről körbeér', () => {
    act(() => {
      root.render(<Tabs items={ITEMS} />);
    });
    const firstTab = renderedTabs()[0];
    if (firstTab === undefined) {
      throw new Error('nincs kirajzolt fül');
    }
    pressKeyOn(firstTab, 'ArrowLeft');
    expect(renderedPanels().map((panel) => panel.hidden)).toEqual([true, true, false]);
  });

  it('Home az elsőre, End az utolsóra lép', () => {
    act(() => {
      root.render(<Tabs items={ITEMS} />);
    });
    const firstTab = renderedTabs()[0];
    if (firstTab === undefined) {
      throw new Error('nincs kirajzolt fül');
    }
    pressKeyOn(firstTab, 'End');
    expect(renderedPanels().map((panel) => panel.hidden)).toEqual([true, true, false]);

    const lastTab = renderedTabs()[2];
    if (lastTab === undefined) {
      throw new Error('nincs kirajzolt fül');
    }
    pressKeyOn(lastTab, 'Home');
    expect(renderedPanels().map((panel) => panel.hidden)).toEqual([false, true, true]);
  });

  it('a fókusz a célfülre kerül a nyíl után', () => {
    act(() => {
      root.render(<Tabs items={ITEMS} />);
    });
    const firstTab = renderedTabs()[0];
    if (firstTab === undefined) {
      throw new Error('nincs kirajzolt fül');
    }
    pressKeyOn(firstTab, 'ArrowRight');
    expect(document.activeElement).toBe(renderedTabs()[1]);
  });

  it('nem kezelt billentyű nem vált fület', () => {
    act(() => {
      root.render(<Tabs items={ITEMS} />);
    });
    const firstTab = renderedTabs()[0];
    if (firstTab === undefined) {
      throw new Error('nincs kirajzolt fül');
    }
    pressKeyOn(firstTab, 'a');
    expect(renderedPanels().map((panel) => panel.hidden)).toEqual([false, true, true]);
  });

  it('jobbról balra író irányban a nyilak megfordulnak', () => {
    // A pinelt happy-dom a `dir="rtl"` attribútumot NEM oldja fel a
    // számított `direction` értékre (saját mérés, 2026-09-01: az öröklött
    // érték "ltr" marad), az inline `style.direction` értéket viszont igen.
    // A teszt ezért az utóbbival állítja be az írásirányt.
    act(() => {
      root.render(<Tabs items={ITEMS} />);
    });
    const firstTab = renderedTabs()[0];
    if (firstTab === undefined) {
      throw new Error('nincs kirajzolt fül');
    }
    firstTab.style.direction = 'rtl';
    pressKeyOn(firstTab, 'ArrowRight');
    expect(renderedPanels().map((panel) => panel.hidden)).toEqual([true, true, false]);
  });
});
