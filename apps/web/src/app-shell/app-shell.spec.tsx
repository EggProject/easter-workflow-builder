import type { FetchFunction } from '@easter-workflow-builder/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppShell } from './app-shell.tsx';

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

  it('a kapcsolat megnyílása után, várakozó pótlás nélkül, nincs stream státusz felirat', async () => {
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

  it('ismeretlen útvonalon a "nem található" képernyőt rajzolja', async () => {
    // eslint-disable-next-line unicorn/no-null -- lásd fent.
    globalThis.history.pushState(null, '', '/nincs-ilyen');
    render();
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Az oldal nem található');
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
