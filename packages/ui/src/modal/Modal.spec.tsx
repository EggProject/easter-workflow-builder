import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Modal, type ModalSize } from './Modal.tsx';

function pressKey(key: string): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

describe('Modal', () => {
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

  function renderedDialog(): HTMLDivElement {
    const dialog = container.querySelector<HTMLDivElement>('[role="dialog"]');
    if (dialog === null) {
      throw new Error('a modális nem található a kirajzolt fán');
    }
    return dialog;
  }

  it('zárt állapotban semmit nem rajzol ki', () => {
    act(() => {
      root.render(<Modal open={false} title="Cím" />);
    });
    expect(container.getHTML()).toBe('');
  });

  it('nyitott állapotban dialógus szereppel és modális jelzéssel rajzol ki', () => {
    act(() => {
      root.render(<Modal open title="Workflow törlése" />);
    });
    expect(renderedDialog().className).toBe('modal modal--md');
    expect(renderedDialog().getAttribute('aria-modal')).toBe('true');
    expect(container.querySelector('.modal-overlay')).not.toBeNull();
  });

  it('a cím aria-labelledby hivatkozással kötődik a dialógushoz', () => {
    act(() => {
      root.render(<Modal open title="Workflow törlése" />);
    });
    const titleElement = container.querySelector('.modal__title');
    expect(titleElement?.textContent).toBe('Workflow törlése');
    expect(renderedDialog().getAttribute('aria-labelledby')).toBe(titleElement?.id);
  });

  it('cím nélkül nincs aria-labelledby, de a hívó aria-label kikerül', () => {
    act(() => {
      root.render(<Modal open aria-label="Megerősítés" />);
    });
    expect(renderedDialog().getAttribute('aria-labelledby')).toBeNull();
    expect(renderedDialog().getAttribute('aria-label')).toBe('Megerősítés');
  });

  it('a hívó saját aria-labelledby értéke erősebb a generáltnál', () => {
    act(() => {
      root.render(<Modal open title="Cím" aria-labelledby="kulso" />);
    });
    expect(renderedDialog().getAttribute('aria-labelledby')).toBe('kulso');
  });

  it('az alcím aria-describedby hivatkozást kap, a hívó értéke mellé', () => {
    act(() => {
      root.render(<Modal open title="Cím" subtitle="Ez végleges" aria-describedby="kulso" />);
    });
    const subtitleElement = container.querySelector('.modal__subtitle');
    expect(subtitleElement?.textContent).toBe('Ez végleges');
    expect(renderedDialog().getAttribute('aria-describedby')).toBe(`kulso ${subtitleElement?.id ?? ''}`);
  });

  it('alcím és hívói érték nélkül nincs aria-describedby', () => {
    act(() => {
      root.render(<Modal open title="Cím" />);
    });
    expect(renderedDialog().getAttribute('aria-describedby')).toBeNull();
  });

  const sizes: readonly ModalSize[] = ['sm', 'md', 'lg', 'xl'];
  it.each(sizes)('a size="%s" a "modal modal--%s" osztálylistát adja', (size) => {
    act(() => {
      root.render(<Modal open title="Cím" size={size} />);
    });
    expect(renderedDialog().className).toBe(`modal modal--${size}`);
  });

  it('eyebrow, ikon, törzs és lábléc a saját elemébe kerül', () => {
    act(() => {
      root.render(
        <Modal open title="Cím" eyebrow="VESZÉLYES" icon="!" iconVariant="danger" footer={<button>Mégse</button>}>
          <p>Törzs</p>
        </Modal>,
      );
    });
    expect(container.querySelector('.modal__eyebrow')?.textContent).toBe('VESZÉLYES');
    const iconElement = container.querySelector('.modal__icon');
    expect(iconElement?.className).toBe('modal__icon modal__icon--danger');
    expect(iconElement?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('.modal__body')?.textContent).toBe('Törzs');
    expect(container.querySelector('.modal__footer')?.textContent).toBe('Mégse');
  });

  it('ikon variáns nélkül az info variáns az alapértelmezés', () => {
    act(() => {
      root.render(<Modal open title="Cím" icon="i" />);
    });
    expect(container.querySelector('.modal__icon')?.className).toBe('modal__icon modal__icon--info');
  });

  it('törzs, lábléc és ikon nélkül azok az elemek nem jelennek meg', () => {
    act(() => {
      root.render(<Modal open title="Cím" />);
    });
    expect(container.querySelector('.modal__body')).toBeNull();
    expect(container.querySelector('.modal__footer')).toBeNull();
    expect(container.querySelector('.modal__icon')).toBeNull();
    expect(container.querySelector('.modal__eyebrow')).toBeNull();
    expect(container.querySelector('.modal__subtitle')).toBeNull();
  });

  it('onClose nélkül nincs bezárás gomb', () => {
    act(() => {
      root.render(<Modal open title="Cím" />);
    });
    expect(container.querySelector('.modal__close')).toBeNull();
  });

  it('bezárás gombbal: a gomb aria-label felirata a hívóé, és kattintásra zár', () => {
    let closeCount = 0;
    act(() => {
      root.render(
        <Modal
          open
          title="Cím"
          closeButtonLabel="Bezárás"
          onClose={() => {
            closeCount += 1;
          }}
        />,
      );
    });
    const closeButton = container.querySelector<HTMLButtonElement>('.modal__close');
    expect(closeButton?.getAttribute('aria-label')).toBe('Bezárás');
    act(() => {
      closeButton?.click();
    });
    expect(closeCount).toBe(1);
  });

  it('bezárás Escape billentyűvel', () => {
    let closeCount = 0;
    act(() => {
      root.render(
        <Modal
          open
          title="Cím"
          onClose={() => {
            closeCount += 1;
          }}
        />,
      );
    });
    pressKey('Escape');
    expect(closeCount).toBe(1);
  });

  it('más billentyű nem zár be', () => {
    let closeCount = 0;
    act(() => {
      root.render(
        <Modal
          open
          title="Cím"
          onClose={() => {
            closeCount += 1;
          }}
        />,
      );
    });
    pressKey('Enter');
    expect(closeCount).toBe(0);
  });

  it('zárt modális nem figyeli az Escape billentyűt', () => {
    let closeCount = 0;
    act(() => {
      root.render(
        <Modal
          open={false}
          title="Cím"
          onClose={() => {
            closeCount += 1;
          }}
        />,
      );
    });
    pressKey('Escape');
    expect(closeCount).toBe(0);
  });

  it('onClose nélkül az Escape nem dob hibát', () => {
    act(() => {
      root.render(<Modal open title="Cím" />);
    });
    pressKey('Escape');
    expect(renderedDialog()).not.toBeNull();
  });

  it('bezárás a háttérre kattintva', () => {
    let closeCount = 0;
    act(() => {
      root.render(
        <Modal
          open
          title="Cím"
          onClose={() => {
            closeCount += 1;
          }}
        />,
      );
    });
    act(() => {
      container.querySelector<HTMLDivElement>('.modal-overlay')?.click();
    });
    expect(closeCount).toBe(1);
  });

  it('a panelre kattintás nem zár be', () => {
    let closeCount = 0;
    act(() => {
      root.render(
        <Modal
          open
          title="Cím"
          onClose={() => {
            closeCount += 1;
          }}
        />,
      );
    });
    act(() => {
      renderedDialog().click();
    });
    expect(closeCount).toBe(0);
  });

  it('closeOnOverlay=false esetén a háttérre kattintás nem zár be', () => {
    let closeCount = 0;
    act(() => {
      root.render(
        <Modal
          open
          title="Cím"
          closeOnOverlay={false}
          onClose={() => {
            closeCount += 1;
          }}
        />,
      );
    });
    act(() => {
      container.querySelector<HTMLDivElement>('.modal-overlay')?.click();
    });
    expect(closeCount).toBe(0);
  });

  it('onClose nélkül a háttérre kattintás nem dob hibát', () => {
    act(() => {
      root.render(<Modal open title="Cím" />);
    });
    act(() => {
      container.querySelector<HTMLDivElement>('.modal-overlay')?.click();
    });
    expect(renderedDialog()).not.toBeNull();
  });

  it('bezárás után a keydown figyelő leszerelődik', () => {
    let closeCount = 0;
    const onClose = (): void => {
      closeCount += 1;
    };
    act(() => {
      root.render(<Modal open title="Cím" onClose={onClose} />);
    });
    act(() => {
      root.render(<Modal open={false} title="Cím" onClose={onClose} />);
    });
    pressKey('Escape');
    expect(closeCount).toBe(0);
  });
});
