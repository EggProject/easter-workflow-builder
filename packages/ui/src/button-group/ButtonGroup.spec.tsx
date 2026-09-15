import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Button } from '../button/Button.tsx';
import { ButtonGroup } from './ButtonGroup.tsx';

describe('ButtonGroup', () => {
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

  function renderedGroup(): HTMLDivElement {
    const group = container.querySelector<HTMLDivElement>('div.button-group');
    if (group === null) {
      throw new Error('a gombcsoport nem található a kirajzolt fán');
    }
    return group;
  }

  it('role="group" szerepet és a kapott hozzáférhető nevet viseli', () => {
    act(() => {
      root.render(<ButtonGroup aria-label="Gráf műveletek" />);
    });
    expect(renderedGroup().getAttribute('role')).toBe('group');
    expect(renderedGroup().getAttribute('aria-label')).toBe('Gráf műveletek');
    expect(renderedGroup().className).toBe('button-group');
  });

  it('a saját className hozzáadódik a listához', () => {
    act(() => {
      root.render(<ButtonGroup aria-label="x" className="egyedi" />);
    });
    expect(renderedGroup().className).toBe('button-group egyedi');
  });

  it('a gyerek gombokat a saját osztályukkal, sorrendben rajzolja ki (split button minta)', () => {
    act(() => {
      root.render(
        <ButtonGroup aria-label="Gráf műveletek">
          <Button size="sm">Mentés</Button>
          <Button size="sm" variant="secondary">
            Elrendezés
          </Button>
        </ButtonGroup>,
      );
    });
    const buttons = [...renderedGroup().querySelectorAll('button')];
    expect(buttons.map((button) => button.textContent)).toEqual(['Mentés', 'Elrendezés']);
    expect(buttons.map((button) => button.className)).toEqual([
      'btn btn--primary btn--sm',
      'btn btn--secondary btn--sm',
    ]);
  });
});
