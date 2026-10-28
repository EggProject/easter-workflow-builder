import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileUpload, type FileUploadFile, type FileUploadLabels } from './FileUpload.tsx';

function dropEvent(files: readonly File[]): Event {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { files } });
  return event;
}

describe('FileUpload', () => {
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

  function renderedZone(): HTMLLabelElement {
    const zone = container.querySelector<HTMLLabelElement>('label.dropzone');
    if (zone === null) {
      throw new Error('a lerakó felület nem található a kirajzolt fán');
    }
    return zone;
  }

  function renderedInput(): HTMLInputElement {
    const input = container.querySelector<HTMLInputElement>('input.dropzone__input');
    if (input === null) {
      throw new Error('a fájl választó nem található a kirajzolt fán');
    }
    return input;
  }

  function rows(): readonly HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>('.dropzone-file')];
  }

  describe('a lerakó felület', () => {
    it('alapértelmezésben md méretű, többes, a forrás angol szövegeivel', () => {
      act(() => {
        root.render(<FileUpload />);
      });
      expect(renderedZone().className).toBe('dropzone');
      expect(renderedInput().type).toBe('file');
      expect(renderedInput().multiple).toBe(true);
      expect(renderedInput().hasAttribute('accept')).toBe(false);
      expect(container.querySelector('.dropzone__copy')?.textContent).toBe('Drop files here or browse');
      expect(container.querySelector(':scope .dropzone__copy em')?.textContent).toBe('browse');
      expect(container.querySelector('.dropzone__hint')?.textContent).toBe('up to 25 MB each');
      expect(container.querySelector('.dropzone-files')).toBeNull();
    });

    it('a size="sm" a kompakt osztályt adja, a multiple={false} egyes választót', () => {
      act(() => {
        root.render(<FileUpload size="sm" multiple={false} className="extra" />);
      });
      expect(renderedZone().className).toBe('dropzone dropzone--small');
      expect(renderedInput().multiple).toBe(false);
      expect(container.firstElementChild?.className).toBe('extra');
    });

    it('az accept a tippben pontok nélkül, nagybetűvel áll', () => {
      act(() => {
        root.render(<FileUpload accept=".zip,.tar" />);
      });
      expect(renderedInput().getAttribute('accept')).toBe('.zip,.tar');
      expect(container.querySelector('.dropzone__hint')?.textContent).toBe('ZIP,TAR · up to 25 MB each');
    });

    it('az üres accept nem ad előtagot a tippnek', () => {
      act(() => {
        root.render(<FileUpload accept="" />);
      });
      expect(container.querySelector('.dropzone__hint')?.textContent).toBe('up to 25 MB each');
    });

    it('a title és a hint felülírja az alapszöveget', () => {
      act(() => {
        root.render(<FileUpload title="Húzd ide a csomagot" hint="legfeljebb 30 MB" />);
      });
      expect(container.querySelector('.dropzone__copy')?.textContent).toBe('Húzd ide a csomagot');
      expect(container.querySelector('.dropzone__hint')?.textContent).toBe('legfeljebb 30 MB');
    });

    it('a labels a saját szövegeket adja', () => {
      const labels: FileUploadLabels = {
        dropPrefix: 'Húzd ide a fájlt vagy ',
        browse: 'tallózz',
        sizeLimit: 'legfeljebb 30 MB',
        uploaded: 'feltöltve',
        failed: 'sikertelen',
        progress: (name) => `Feltöltés: ${name}`,
        remove: (name) => `Eltávolítás: ${name}`,
      };
      act(() => {
        root.render(
          <FileUpload
            accept=".zip"
            labels={labels}
            files={[
              { name: 'a.zip', progress: 10 },
              { name: 'b.zip', status: 'done' },
              { name: 'c.zip', status: 'error' },
            ]}
            onRemove={vi.fn()}
          />,
        );
      });
      expect(container.querySelector('.dropzone__copy')?.textContent).toBe('Húzd ide a fájlt vagy tallózz');
      expect(container.querySelector('.dropzone__hint')?.textContent).toBe('ZIP · legfeljebb 30 MB');
      expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-label')).toBe('Feltöltés: a.zip');
      expect(container.querySelector(':scope .dropzone-file__sr')?.textContent).toBe('b.zip feltöltve');
      expect(container.querySelectorAll('.dropzone-file__sr')[1]?.textContent).toBe('c.zip sikertelen');
      expect(container.querySelector('button')?.getAttribute('aria-label')).toBe('Eltávolítás: a.zip');
    });
  });

  describe('fájl bevitel', () => {
    it('a natív választó change eseménye a kiválasztott fájlokat adja', () => {
      const onFiles = vi.fn();
      const file = new File(['x'], 'a.zip');
      act(() => {
        root.render(<FileUpload onFiles={onFiles} />);
      });
      Object.defineProperty(renderedInput(), 'files', { value: [file], configurable: true });
      act(() => {
        renderedInput().dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(onFiles).toHaveBeenCalledWith([file]);
    });

    it('a hiányzó fájllista üres tömböt ad', () => {
      const onFiles = vi.fn();
      act(() => {
        root.render(<FileUpload onFiles={onFiles} />);
      });
      Object.defineProperty(renderedInput(), 'files', { value: undefined, configurable: true });
      act(() => {
        renderedInput().dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(onFiles).toHaveBeenCalledWith([]);
    });

    it('onFiles nélkül a change és a drop nem dob hibát', () => {
      act(() => {
        root.render(<FileUpload />);
      });
      Object.defineProperty(renderedInput(), 'files', { value: [], configurable: true });
      act(() => {
        renderedInput().dispatchEvent(new Event('change', { bubbles: true }));
        renderedZone().dispatchEvent(dropEvent([]));
      });
      expect(renderedZone().className).toBe('dropzone');
    });

    it('a ráejtett fájlok az onFiles-ba kerülnek, a drop az is-dragging állapotot lezárja', () => {
      const onFiles = vi.fn();
      const file = new File(['x'], 'a.zip');
      act(() => {
        root.render(<FileUpload onFiles={onFiles} />);
      });
      act(() => {
        renderedZone().dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
      });
      expect(renderedZone().className).toBe('dropzone is-dragging');
      const drop = dropEvent([file]);
      act(() => {
        renderedZone().dispatchEvent(drop);
      });
      expect(onFiles).toHaveBeenCalledWith([file]);
      expect(drop.defaultPrevented).toBe(true);
      expect(renderedZone().className).toBe('dropzone');
    });

    it('a dragover megakadályozza az alapértelmezett műveletet, a dragleave lezárja az is-dragging állapotot', () => {
      act(() => {
        root.render(<FileUpload />);
      });
      const over = new Event('dragover', { bubbles: true, cancelable: true });
      act(() => {
        renderedZone().dispatchEvent(over);
      });
      expect(over.defaultPrevented).toBe(true);
      expect(renderedZone().className).toBe('dropzone is-dragging');
      act(() => {
        renderedZone().dispatchEvent(new Event('dragleave', { bubbles: true }));
      });
      expect(renderedZone().className).toBe('dropzone');
    });
  });

  describe('fájl sorok', () => {
    it('soronként név és méret, jelzés és eltávolító gomb nélkül', () => {
      act(() => {
        root.render(<FileUpload files={[{ name: 'a.zip', size: 2048 }, { name: 'b.zip' }]} />);
      });
      expect(rows()).toHaveLength(2);
      expect(rows()[0]?.querySelector('.dropzone-file__name')?.textContent).toBe('a.zip');
      expect(rows()[0]?.querySelector('.dropzone-file__meta')?.textContent).toBe('2.0 KB');
      expect(rows()[1]?.querySelector('.dropzone-file__meta')?.textContent).toBe('');
      expect(container.querySelector('[role="progressbar"]')).toBeNull();
      expect(container.querySelector('[role="status"]')).toBeNull();
      expect(container.querySelector('button')).toBeNull();
    });

    it('a folyamatjelző a szorított értéket mutatja: 150 -> 100, -5 -> 0, NaN -> 0, 41.6 -> kerekített', () => {
      const progresses = [150, -5, NaN, 41.6];
      act(() => {
        root.render(
          <FileUpload
            files={progresses.map((progress, index): FileUploadFile => ({ name: `f${String(index)}`, progress }))}
          />,
        );
      });
      const bars = [...container.querySelectorAll<HTMLElement>('[role="progressbar"]')];
      expect(bars.map((bar) => bar.getAttribute('aria-valuenow'))).toEqual(['100', '0', '0', '42']);
      expect(bars.map((bar) => bar.querySelector('span')?.style.width)).toEqual(['100%', '0%', '0%', '41.6%']);
      expect(bars[0]?.getAttribute('aria-valuemin')).toBe('0');
      expect(bars[0]?.getAttribute('aria-valuemax')).toBe('100');
      expect(bars[0]?.getAttribute('aria-label')).toBe('Upload progress for f0');
    });

    it('kész állapotban nincs folyamatjelző, a státusz jelzés a ✓ szöveget és a képernyőolvasó mondatot adja', () => {
      act(() => {
        root.render(<FileUpload files={[{ name: 'a.zip', progress: 100, status: 'done' }]} />);
      });
      expect(container.querySelector('[role="progressbar"]')).toBeNull();
      const status = container.querySelector('[role="status"]');
      expect(status?.className).toBe('dropzone-file__status');
      expect(status?.getAttribute('aria-live')).toBe('polite');
      expect(status?.getAttribute('aria-atomic')).toBe('true');
      expect(status?.querySelector('[aria-hidden="true"]')?.textContent).toBe('✓ uploaded');
      expect(status?.querySelector('.dropzone-file__sr')?.textContent).toBe('a.zip uploaded');
    });

    it('hibás állapotban a hiba osztály, a "failed" szöveg és a folyamatjelző is megmarad', () => {
      act(() => {
        root.render(<FileUpload files={[{ name: 'a.zip', progress: 30, status: 'error' }]} />);
      });
      const status = container.querySelector('[role="status"]');
      expect(status?.className).toBe('dropzone-file__status dropzone-file__status--error');
      expect(status?.querySelector('[aria-hidden="true"]')?.textContent).toBe('failed');
      expect(status?.querySelector('.dropzone-file__sr')?.textContent).toBe('a.zip failed');
      expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
    });

    it('az eltávolító gomb a saját sor fájljával hívja az onRemove-ot, type="button"', () => {
      const onRemove = vi.fn();
      const files: readonly FileUploadFile[] = [{ name: 'a.zip' }, { name: 'b.zip' }];
      act(() => {
        root.render(<FileUpload files={files} onRemove={onRemove} />);
      });
      const buttons = [...container.querySelectorAll<HTMLButtonElement>('button.dropzone-file__remove')];
      expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['Remove a.zip', 'Remove b.zip']);
      expect(buttons[0]?.type).toBe('button');
      act(() => {
        buttons[1]?.click();
      });
      expect(onRemove).toHaveBeenCalledExactlyOnceWith(files[1]);
    });
  });
});
