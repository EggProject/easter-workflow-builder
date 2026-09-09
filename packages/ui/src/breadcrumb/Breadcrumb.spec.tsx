import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Breadcrumb } from './Breadcrumb.tsx';

describe('Breadcrumb', () => {
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

  function renderedNav(): HTMLElement {
    const nav = container.querySelector<HTMLElement>('nav.breadcrumb');
    if (nav === null) {
      throw new Error('a morzsamenü nem található a kirajzolt fán');
    }
    return nav;
  }

  it('ős nélkül egyetlen, aria-current="page" jelölésű, nem interaktív elemet rajzol', () => {
    act(() => {
      root.render(<Breadcrumb current="Workflow-k" />);
    });

    expect(renderedNav().getAttribute('aria-label')).toBe('Morzsamenü');
    const items = [...renderedNav().querySelectorAll('.breadcrumb__item')];
    expect(items).toHaveLength(1);
    expect(items[0]?.tagName).toBe('SPAN');
    expect(items[0]?.getAttribute('aria-current')).toBe('page');
    expect(items[0]?.textContent).toBe('Workflow-k');
    expect(renderedNav().querySelector('.breadcrumb__separator')).toBeNull();
  });

  it('egy őssel valódi linket rajzol elválasztóval, az aktuális elem nem link', () => {
    const onClick = vi.fn();
    act(() => {
      root.render(<Breadcrumb ancestors={[{ label: 'Workflow-k', href: '/', onClick }]} current="Szerkesztő" />);
    });

    const nav = renderedNav();
    const link = nav.querySelector<HTMLAnchorElement>('a.breadcrumb__item');
    if (link === null) {
      throw new Error('a teszt nem talált ős linket');
    }
    expect(link.getAttribute('href')).toBe('/');
    expect(link.textContent).toBe('Workflow-k');
    expect(nav.querySelector('.breadcrumb__separator')?.textContent).toBe('/');

    const current = nav.querySelector('.breadcrumb__item--current');
    expect(current?.tagName).toBe('SPAN');
    expect(current?.getAttribute('aria-current')).toBe('page');
    expect(current?.textContent).toBe('Szerkesztő');

    act(() => {
      link.click();
    });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('több ős esetén minden ős saját elválasztóval, sorrendben jelenik meg', () => {
    act(() => {
      root.render(
        <Breadcrumb
          ancestors={[
            { label: 'Első', href: '/elso' },
            { label: 'Második', href: '/masodik' },
          ]}
          current="Harmadik"
        />,
      );
    });

    const links = [...renderedNav().querySelectorAll<HTMLAnchorElement>('a.breadcrumb__item')];
    expect(links.map((link) => link.textContent)).toEqual(['Első', 'Második']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/elso', '/masodik']);
    expect(renderedNav().querySelectorAll('.breadcrumb__separator')).toHaveLength(2);
  });
});
