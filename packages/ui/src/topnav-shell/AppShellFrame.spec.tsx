import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppShellFrame } from './AppShellFrame';

describe('AppShellFrame', () => {
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

  it('a bar mind a harom zonajat es a design system osztalyait rajzolja ki', () => {
    act(() => {
      root.render(
        <AppShellFrame
          brand={<span>Easter</span>}
          navigation={<a href="/">Workflow-k</a>}
          actions={<button type="button">Téma</button>}
          pageTitle="Workflow lista"
        >
          <p>Tartalom</p>
        </AppShellFrame>,
      );
    });

    expect(container.querySelector('.app-tn')).not.toBeNull();
    expect(container.querySelector('.app-tn__bar')).not.toBeNull();
    expect(container.querySelector('.app-tn__brand')?.textContent).toBe('Easter');
    expect(container.querySelector('.app-tn__navigation')?.textContent).toBe('Workflow-k');
    expect(container.querySelector('.app-tn__actions')?.textContent).toBe('Téma');
  });

  it('a content vazat es az oldal cimet kirajzolja', () => {
    act(() => {
      root.render(
        <AppShellFrame brand="B" navigation="N" actions="A" pageTitle="Futás előzmények">
          <p>Lista</p>
        </AppShellFrame>,
      );
    });

    expect(container.querySelector('.app-tn__main')).not.toBeNull();
    expect(container.querySelector('.app-tn__inner')).not.toBeNull();
    expect(container.querySelector('.app-pagehead')).not.toBeNull();
    expect(container.querySelector('.app-pagehead__title')?.textContent).toBe('Futás előzmények');
    expect(container.querySelector('.app-content')?.textContent).toBe('Lista');
  });

  it('a pageActions opcionalis: hianyaban nincs .app-pagehead__actions elem', () => {
    act(() => {
      root.render(
        <AppShellFrame brand="B" navigation="N" actions="A" pageTitle="Cím">
          <p>Lista</p>
        </AppShellFrame>,
      );
    });

    expect(container.querySelector('.app-pagehead__actions')).toBeNull();
  });

  it('a pageActions jelenleteben a .app-pagehead__actions elem kirajzolodik', () => {
    act(() => {
      root.render(
        <AppShellFrame
          brand="B"
          navigation="N"
          actions="A"
          pageTitle="Cím"
          pageActions={<button type="button">Új</button>}
        >
          <p>Lista</p>
        </AppShellFrame>,
      );
    });

    expect(container.querySelector('.app-pagehead__actions')?.textContent).toBe('Új');
  });
});
