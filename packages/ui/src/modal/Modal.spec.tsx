import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Modal, type ModalSize } from './Modal.tsx';

function pressKey(key: string): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

// A Tab kezelés a dialógus elem `onKeyDown` propján megy (React szintetikus
// esemény delegálás), nem `document`-re kötött natív figyelőn - a natív
// eseményt ezért a ténylegesen fókuszált elemen kell kiváltani, hogy a React
// gyökér konténerig felbuborékoljon.
function pressTab(options: { readonly shiftKey?: boolean } = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true, ...options });
  const target = document.activeElement ?? document;
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
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

  // A dialógus DOM sorrendje a Modal.tsx felépítése szerint: `children` (a
  // `.modal__body`) MEGELŐZI a `footer`-t. Három fókuszálható elemmel
  // (input, "Mégse", "Törlés") tehát az input az ELSŐ, a "Mégse" a KÖZTES,
  // a "Törlés" az UTOLSÓ - a köztes teszteknek ezért a "Mégse" gombra kell
  // fókuszálniuk, nem az inputra.
  function renderThreeFocusableElementModal(): void {
    act(() => {
      root.render(
        <Modal
          open
          title="Cím"
          footer={
            <>
              <button type="button">Mégse</button>
              <button type="button">Törlés</button>
            </>
          }
        >
          <input type="text" />
        </Modal>,
      );
    });
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

  // A fókusz csapda és a fókusz visszaállítás unit lefedettsége. A valós
  // böngésző fókusz mozgás Playwright e2e teszttel is igazolt (SPEC-007
  // T-008-14 kiegészítés), itt a happy-dom által hűen adott `.focus()` és
  // `document.activeElement` viselkedésre épülő ágak lefedettsége a cél.
  describe('fókusz csapda és fókusz visszaállítás', () => {
    it('megnyitáskor a dialóguson belüli első fókuszálható elemre kerül a fókusz', () => {
      act(() => {
        root.render(
          <Modal open title="Cím" footer={<button type="button">Mégse</button>}>
            <input type="text" />
          </Modal>,
        );
      });
      expect(document.activeElement).toBe(container.querySelector('input'));
    });

    it('fókuszálható gyerek nélkül a dialógusra magára kerül a fókusz', () => {
      act(() => {
        root.render(<Modal open title="Cím" />);
      });
      expect(document.activeElement).toBe(renderedDialog());
    });

    it('bezáráskor a fókusz visszatér a megnyitó elemre', () => {
      const trigger = document.createElement('button');
      document.body.append(trigger);
      trigger.focus();
      expect(document.activeElement).toBe(trigger);

      act(() => {
        root.render(
          <Modal open title="Cím">
            <input type="text" />
          </Modal>,
        );
      });
      expect(document.activeElement).not.toBe(trigger);

      act(() => {
        root.render(<Modal open={false} title="Cím" />);
      });
      expect(document.activeElement).toBe(trigger);
      trigger.remove();
    });

    it('nem HTMLElement korábbi fókusz esetén bezáráskor nem dob hibát és nem próbál fókuszálni', () => {
      const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      Object.defineProperty(document, 'activeElement', { value: svgElement, configurable: true });

      try {
        act(() => {
          root.render(
            <Modal open title="Cím">
              <input type="text" />
            </Modal>,
          );
        });
      } finally {
        // Csak az imént, az `document` PÉLDÁNYON felvett saját tulajdonságot
        // távolítja el - ezután a `Document.prototype` eredeti accessora
        // (amit happy-dom ad) érvényesül újra a többi tesztre.
        Reflect.deleteProperty(document, 'activeElement');
      }

      expect(() => {
        act(() => {
          root.render(<Modal open={false} title="Cím" />);
        });
      }).not.toThrow();
    });

    it('utolsó elemen Tab a legelsőre ugrik, és megelőzi az alapértelmezett viselkedést', () => {
      act(() => {
        root.render(
          <Modal open title="Cím" footer={<button type="button">Mégse</button>}>
            <input type="text" />
          </Modal>,
        );
      });
      const input = container.querySelector<HTMLInputElement>('input');
      const cancelButton = container.querySelector<HTMLButtonElement>(':scope .modal__footer button');
      act(() => {
        cancelButton?.focus();
      });
      const event = pressTab();
      expect(document.activeElement).toBe(input);
      expect(event.defaultPrevented).toBe(true);
    });

    it('első elemen Shift+Tab a legutolsóra ugrik', () => {
      act(() => {
        root.render(
          <Modal open title="Cím" footer={<button type="button">Mégse</button>}>
            <input type="text" />
          </Modal>,
        );
      });
      const cancelButton = container.querySelector<HTMLButtonElement>(':scope .modal__footer button');
      const event = pressTab({ shiftKey: true });
      expect(document.activeElement).toBe(cancelButton);
      expect(event.defaultPrevented).toBe(true);
    });

    it('köztes elemen a Tab nem változtat fókuszt és nem előzi meg az alapértelmezettet', () => {
      renderThreeFocusableElementModal();
      const middleButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Mégse');
      act(() => {
        middleButton?.focus();
      });
      const event = pressTab();
      expect(document.activeElement).toBe(middleButton);
      expect(event.defaultPrevented).toBe(false);
    });

    it('köztes elemen a Shift+Tab sem változtat fókuszt', () => {
      renderThreeFocusableElementModal();
      const middleButton = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Mégse');
      act(() => {
        middleButton?.focus();
      });
      const event = pressTab({ shiftKey: true });
      expect(document.activeElement).toBe(middleButton);
      expect(event.defaultPrevented).toBe(false);
    });

    it('a dialóguson belül más billentyű (nem Tab) nem indít fókusz mozgást', () => {
      renderThreeFocusableElementModal();
      const input = container.querySelector<HTMLInputElement>('input');
      act(() => {
        input?.focus();
      });
      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
      act(() => {
        input?.dispatchEvent(event);
      });
      expect(document.activeElement).toBe(input);
      expect(event.defaultPrevented).toBe(false);
    });

    it('fókuszálható elem nélkül a Tab a dialógusra fókuszál és megelőzi az alapértelmezettet', () => {
      act(() => {
        root.render(<Modal open title="Cím" />);
      });
      const event = pressTab();
      expect(document.activeElement).toBe(renderedDialog());
      expect(event.defaultPrevented).toBe(true);
    });

    it('zárt modális nem figyeli a Tab billentyűt', () => {
      act(() => {
        root.render(<Modal open={false} title="Cím" />);
      });
      const event = pressTab();
      expect(event.defaultPrevented).toBe(false);
    });
  });
});
