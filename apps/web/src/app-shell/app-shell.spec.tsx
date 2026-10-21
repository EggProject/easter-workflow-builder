import type { FetchFunction } from '@easter-workflow-builder/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserGraphElementIdGenerator } from '../graph-editor/browser-graph-element-id-generator.ts';
import type { GraphEditorScreen } from '../graph-editor/GraphEditorScreen.tsx';
import { AppShell } from './app-shell.tsx';

type GraphEditorScreenProperties = ComponentProps<typeof GraphEditorScreen>;

/**
 * A szerkesztő képernyő valódi megvalósítása fut, csak a neki átadott propokat
 * rögzítjük (`vi.hoisted` a `vi.mock` fölé emelve, Vitest dokumentált mintája),
 * hogy a befecskendezett azonosító generátort közvetlenül lehessen ellenőrizni.
 */
const { capturedScreenProperties } = vi.hoisted(() => {
  const capturedScreenProperties: GraphEditorScreenProperties[] = [];
  return { capturedScreenProperties };
});

vi.mock('../graph-editor/GraphEditorScreen.tsx', async (importOriginal) => {
  const actual = await importOriginal<{ readonly GraphEditorScreen: typeof GraphEditorScreen }>();
  return {
    ...actual,
    GraphEditorScreen: function GraphEditorScreenSpy(properties: GraphEditorScreenProperties) {
      capturedScreenProperties.push(properties);
      return <actual.GraphEditorScreen {...properties} />;
    },
  };
});

const API_ORIGIN = 'https://api.example.test';
const STREAM_ORIGIN = 'https://stream.example.test';

const catchAllFetchFunction: FetchFunction = () => Promise.resolve(Response.json([]));

function findButtonByLabel(scope: ParentNode, label: string): HTMLButtonElement {
  const button = [...scope.querySelectorAll('button')].find(
    (candidate) => candidate.getAttribute('aria-label') === label,
  );
  if (button === undefined) {
    throw new Error(`a teszt nem talált "${label}" aria-label gombot`);
  }
  return button;
}

function findLinkByText(scope: ParentNode, text: string): HTMLAnchorElement {
  const link = [...scope.querySelectorAll('a')].find((candidate) => candidate.textContent === text);
  if (link === undefined) {
    throw new Error(`a teszt nem talált "${text}" feliratú linket`);
  }
  return link;
}

describe('AppShell', () => {
  let container: HTMLDivElement;
  let root: Root;
  // eslint-disable-next-line unicorn/no-unnecessary-global-this -- a bare `EventSource` azonosító ReferenceError-t dobna, mert happy-dom-ban nem létező globális (M-24); a `globalThis.` biztonságos, sosem dobó tulajdonság-elérés.
  const originalEventSource = globalThis.EventSource;

  class FakeEventSource {
    readyState = 0;
    url: string;
    openListeners = new Set<() => void>();

    constructor(url: string) {
      this.url = url;
      createdSources.push(this);
    }

    addEventListener(type: string, listener: () => void): void {
      if (type === 'open') {
        this.openListeners.add(listener);
      }
    }

    close(): void {
      // a teszt nem zár kapcsolatot
    }

    open(): void {
      this.readyState = 1;
      for (const listener of this.openListeners) {
        listener();
      }
    }
  }

  let createdSources: FakeEventSource[] = [];

  beforeEach(() => {
    Object.assign(globalThis, { EventSource: FakeEventSource });
    createdSources = [];
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    Object.assign(globalThis, { EventSource: originalEventSource });
    // eslint-disable-next-line unicorn/no-null -- a DOM `History#pushState` `state` paramétere kötelező, a teszt nem tárol saját állapotot.
    globalThis.history.pushState(null, '', '/');
  });

  function render(): void {
    act(() => {
      root.render(
        <AppShell
          apiOrigin={API_ORIGIN}
          streamOrigin={STREAM_ORIGIN}
          listLimit={25}
          streamReplayLimit={50}
          fetchFunction={catchAllFetchFunction}
        />,
      );
    });
  }

  it('a "/" útvonalon a workflow lista tartalmát rajzolja, "kapcsolódás" stream státusszal', async () => {
    render();
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Új workflow');
    expect(container.textContent).toContain('kapcsolódás');
  });

  it('a kapcsolat megnyílása után, várakozó pótlás nélkül, "élő" stream státuszt mutat', async () => {
    render();
    await act(async () => {
      await Promise.resolve();
    });
    expect(container.textContent).toContain('kapcsolódás');

    const source = createdSources[0];
    if (source === undefined) {
      throw new Error('a teszt nem talált létrehozott FakeEventSource példányt');
    }
    act(() => {
      source.open();
    });

    expect(container.textContent).not.toContain('kapcsolódás');
    expect(container.querySelector(':scope .app-tn__actions .ep-feed__label')?.textContent).toBe('élő');
  });

  it('a "/runs" útvonalon a futás előzmények tartalmát rajzolja', async () => {
    // eslint-disable-next-line unicorn/no-null -- lásd fent.
    globalThis.history.pushState(null, '', '/runs');
    render();
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Futás előzmények');
  });

  it('a "/editor" útvonalon "Szerkesztő" morzsamenüvel a GraphEditorScreen tartalmát rajzolja', async () => {
    // eslint-disable-next-line unicorn/no-null -- lásd fent.
    globalThis.history.pushState(null, '', '/editor');
    render();
    await act(async () => {
      await Promise.resolve();
    });

    // Nincs `?workflowId=` a query stringben, tehát a `GraphEditorScreen`
    // a hiányzó azonosító üzenetét mutatja, kérés nélkül (SPEC-008 5.3).
    expect(container.textContent).toContain('Nincs megadva szerkesztendő workflow');
    expect(container.querySelector('.app-pagehead')?.textContent).toContain('Szerkesztő');
  });

  async function renderEditor(): Promise<
    (name: Parameters<GraphEditorScreenProperties['onWorkflowNameChange']>[0]) => void
  > {
    capturedScreenProperties.length = 0;
    // eslint-disable-next-line unicorn/no-null -- lásd fent.
    globalThis.history.pushState(null, '', '/editor');
    render();
    await act(async () => {
      await Promise.resolve();
    });
    return (name) => {
      const onWorkflowNameChange = capturedScreenProperties.at(-1)?.onWorkflowNameChange;
      if (onWorkflowNameChange === undefined) {
        throw new Error('a teszt nem talált rögzített onWorkflowNameChange propot');
      }
      act(() => {
        onWorkflowNameChange(name);
      });
    };
  }

  function currentItem(): Element | null {
    return container.querySelector(':scope .app-pagehead .breadcrumb__item--current');
  }

  describe('a szerkesztő morzsasorának utolsó eleme a workflow neve (SPEC-008 9. szekció 2. pont)', () => {
    it('betöltés alatt Skeleton áll, a szöveg vizuálisan rejtve az útvonal felirata', async () => {
      // A valódi képernyő workflowId nélkül azonnal `unavailable` értéket
      // jelent, ezért a töltés állapotát a teszt maga jelenti.
      const report = await renderEditor();
      report({ kind: 'loading' });

      expect(currentItem()?.querySelector('.skel')).not.toBeNull();
      expect(currentItem()?.querySelector('.breadcrumb__current-label--hidden')?.textContent).toBe('Szerkesztő');
    });

    it('betöltés után a workflow neve áll a helyén, Skeleton nélkül', async () => {
      const report = await renderEditor();
      report({ kind: 'ready', name: 'Alfa workflow' });

      expect(currentItem()?.textContent).toBe('Alfa workflow');
      expect(currentItem()?.querySelector('.skel')).toBeNull();
    });

    it('elérhetetlen névnél az útvonal felirata marad, Skeleton nélkül', async () => {
      const report = await renderEditor();
      report({ kind: 'unavailable' });

      expect(currentItem()?.textContent).toBe('Szerkesztő');
      expect(currentItem()?.querySelector('.skel')).toBeNull();
    });

    it('más útvonalon a jelentett név nem látszik, és Skeleton sincs', async () => {
      const report = await renderEditor();
      report({ kind: 'ready', name: 'Alfa workflow' });
      act(() => {
        findLinkByText(container, 'Futás előzmények').click();
      });

      expect(currentItem()?.textContent).toBe('Futás előzmények');
      expect(currentItem()?.querySelector('.skel')).toBeNull();
    });
  });

  it('a szerkesztőnek a böngésző oldali azonosító generátort fecskendezi be (SPEC-008 5.8)', async () => {
    capturedScreenProperties.length = 0;
    // eslint-disable-next-line unicorn/no-null -- lásd fent.
    globalThis.history.pushState(null, '', '/editor');
    render();
    await act(async () => {
      await Promise.resolve();
    });

    expect(capturedScreenProperties.at(-1)?.graphElementIdGenerator).toBe(browserGraphElementIdGenerator);
  });

  it('a szerkesztőnek a kliens útválasztó navigációs őrét adja tovább: a regisztrált őr a felső navigációt és a morzsamenüt is megkapja (SPEC-008 5.10)', async () => {
    capturedScreenProperties.length = 0;
    // eslint-disable-next-line unicorn/no-null -- lásd fent.
    globalThis.history.pushState(null, '', '/editor');
    render();
    await act(async () => {
      await Promise.resolve();
    });
    const registerNavigationGuard = capturedScreenProperties.at(-1)?.registerNavigationGuard;
    if (registerNavigationGuard === undefined) {
      throw new Error('a teszt nem talált rögzített registerNavigationGuard propot');
    }
    const proceeds: (() => void)[] = [];
    act(() => {
      registerNavigationGuard((proceed) => {
        proceeds.push(proceed);
      });
    });

    const breadcrumb = container.querySelector('.app-pagehead');
    if (breadcrumb === null) {
      throw new Error('a teszt nem találta a morzsamenüt');
    }
    act(() => {
      findLinkByText(container, 'Futás előzmények').click();
    });
    act(() => {
      findLinkByText(breadcrumb, 'Workflow-k').click();
    });

    expect(proceeds).toHaveLength(2);
    expect(globalThis.location.pathname).toBe('/editor');
    expect(container.querySelector('.app-pagehead')?.textContent).toContain('Szerkesztő');
    expect(container.textContent).toContain('Nincs megadva szerkesztendő workflow');

    await act(async () => {
      proceeds[0]?.();
      await Promise.resolve();
    });
    expect(globalThis.location.pathname).toBe('/runs');
    expect(container.querySelector('.app-pagehead')?.textContent).toContain('Futás előzmények');
  });

  it('a "/run" útvonalon a RunViewScreen tartalmát rajzolja, "Futás nézet" morzsamenüvel', async () => {
    // eslint-disable-next-line unicorn/no-null -- lásd fent.
    globalThis.history.pushState(null, '', '/run');
    render();
    await act(async () => {
      await Promise.resolve();
    });

    // Nincs `?runId=` a query stringben, tehát a `RunViewScreen` a hiányzó
    // azonosító üzenetét mutatja, kérés nélkül (SPEC-008 5. szekció).
    expect(container.textContent).toContain('Nincs megadva megtekintendő futás');
    expect(container.querySelector('.app-pagehead')?.textContent).toContain('Futás nézet');
  });

  it('a "/settings" útvonalon a Beállítások képernyőt rajzolja, "Beállítások" morzsamenüvel (SPEC-008 5.11)', async () => {
    // eslint-disable-next-line unicorn/no-null -- lásd fent.
    globalThis.history.pushState(null, '', '/settings');
    render();
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Visszavonás/újra billentyű módosítója');
    const breadcrumb = container.querySelector(':scope .app-pagehead nav[aria-label="Morzsamenü"]');
    expect(breadcrumb?.querySelector('a')?.textContent).toBe('Workflow-k');
    expect(breadcrumb?.querySelector('[aria-current="page"]')?.textContent).toBe('Beállítások');
  });

  it('a topnav navigáció harmadik linkje a "Beállítások", a "/settings" címre mutat, és kattintásra oda navigál', async () => {
    render();
    await act(async () => {
      await Promise.resolve();
    });

    const navigationLinks = [...container.querySelectorAll<HTMLAnchorElement>(':scope .app-tn__navigation a')];
    expect(navigationLinks.map((link) => link.textContent)).toEqual(['Workflow-k', 'Futás előzmények', 'Beállítások']);
    const settingsLink = findLinkByText(container, 'Beállítások');
    expect(settingsLink.getAttribute('href')).toBe('/settings');
    expect(settingsLink.className).toBe('');

    act(() => {
      settingsLink.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(globalThis.location.pathname).toBe('/settings');
    expect(findLinkByText(container, 'Beállítások').className).toBe('is-on');
    expect(findLinkByText(container, 'Workflow-k').className).toBe('');
    expect(container.textContent).toContain('Visszavonás/újra billentyű módosítója');
  });

  it('ismeretlen útvonalon a "nem található" képernyőt rajzolja', async () => {
    // eslint-disable-next-line unicorn/no-null -- lásd fent.
    globalThis.history.pushState(null, '', '/nincs-ilyen');
    render();
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Az oldal nem található');
  });

  it('a "/" útvonalon a morzsamenü egyetlen, ős nélküli, aktuális "Workflow-k" elemet mutat', async () => {
    render();
    await act(async () => {
      await Promise.resolve();
    });

    const breadcrumb = container.querySelector(':scope .app-pagehead nav[aria-label="Morzsamenü"]');
    if (breadcrumb === null) {
      throw new Error('a teszt nem talált morzsamenüt a page-head-ben');
    }
    expect(breadcrumb.querySelectorAll('a')).toHaveLength(0);
    const current = breadcrumb.querySelector('[aria-current="page"]');
    expect(current?.textContent).toBe('Workflow-k');
  });

  it('a "/runs" útvonalon a morzsamenü "Workflow-k" ős linket és "Futás előzmények" aktuális elemet mutat, a link kattintva visszavisz a gyökérre', async () => {
    // eslint-disable-next-line unicorn/no-null -- lásd fent.
    globalThis.history.pushState(null, '', '/runs');
    render();
    await act(async () => {
      await Promise.resolve();
    });

    const breadcrumb = container.querySelector(':scope .app-pagehead nav[aria-label="Morzsamenü"]');
    if (breadcrumb === null) {
      throw new Error('a teszt nem talált morzsamenüt a page-head-ben');
    }
    const ancestorLink = breadcrumb.querySelector<HTMLAnchorElement>('a');
    expect(ancestorLink?.textContent).toBe('Workflow-k');
    expect(ancestorLink?.getAttribute('href')).toBe('/');
    expect(breadcrumb.querySelector('[aria-current="page"]')?.textContent).toBe('Futás előzmények');

    act(() => {
      ancestorLink?.click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Új workflow');
  });

  it('ismeretlen útvonalon a morzsamenü "Workflow-k" ős linket és "Ismeretlen oldal" aktuális elemet mutat', async () => {
    // eslint-disable-next-line unicorn/no-null -- lásd fent.
    globalThis.history.pushState(null, '', '/nincs-ilyen');
    render();
    await act(async () => {
      await Promise.resolve();
    });

    const breadcrumb = container.querySelector(':scope .app-pagehead nav[aria-label="Morzsamenü"]');
    if (breadcrumb === null) {
      throw new Error('a teszt nem talált morzsamenüt a page-head-ben');
    }
    expect(breadcrumb.querySelector('a')?.textContent).toBe('Workflow-k');
    expect(breadcrumb.querySelector('[aria-current="page"]')?.textContent).toBe('Ismeretlen oldal');
  });

  it('nincs nagy oldalcím (h1) egyetlen útvonalon sem', async () => {
    render();
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.querySelector('h1')).toBeNull();
  });

  it('a topnav bal oldalán a márkajel logó jelenik meg, dekoratív (üres alt) képként', async () => {
    render();
    await act(async () => {
      await Promise.resolve();
    });

    const brand = container.querySelector('.app-tn__brand');
    if (brand === null) {
      throw new Error('a teszt nem talált .app-tn__brand elemet');
    }
    const logo = brand.querySelector('img');
    if (logo === null) {
      throw new Error('a teszt nem talált logó img elemet');
    }
    expect(logo.getAttribute('alt')).toBe('');
    expect(logo.getAttribute('src')).toBeTruthy();
    // A logó a márkanév ELŐTT áll a DOM-ban, a design system saját topnav
    // mintáját követve (eggproject-design-app-common/skeletons/shell-topnav.html).
    const brandChildren = [...brand.children];
    const logoIndex = brandChildren.indexOf(logo);
    const nameIndex = brandChildren.findIndex((child) => child.tagName === 'B');
    expect(logoIndex).toBeGreaterThanOrEqual(0);
    expect(logoIndex).toBeLessThan(nameIndex);
  });

  it('a navigáció gombra kattintva a célútvonal linkje "is-on" osztályt kap, a másik nem', async () => {
    render();
    await act(async () => {
      await Promise.resolve();
    });

    expect(findLinkByText(container, 'Workflow-k').className).toBe('is-on');
    expect(findLinkByText(container, 'Futás előzmények').className).toBe('');

    act(() => {
      findLinkByText(container, 'Futás előzmények').click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(findLinkByText(container, 'Futás előzmények').className).toBe('is-on');
    expect(findLinkByText(container, 'Workflow-k').className).toBe('');

    act(() => {
      findLinkByText(container, 'Workflow-k').click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(findLinkByText(container, 'Workflow-k').className).toBe('is-on');
    expect(findLinkByText(container, 'Futás előzmények').className).toBe('');
  });

  it('a hamburger gomb megnyitja a menüt, majd az útvonalváltás bezárja', async () => {
    render();
    await act(async () => {
      await Promise.resolve();
    });

    const toggle = findButtonByLabel(container, 'Navigáció megnyitása');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    act(() => {
      toggle.click();
    });
    expect(findButtonByLabel(container, 'Navigáció megnyitása').getAttribute('aria-expanded')).toBe('true');

    act(() => {
      findLinkByText(container, 'Futás előzmények').click();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(findButtonByLabel(container, 'Navigáció megnyitása').getAttribute('aria-expanded')).toBe('false');
  });
});
