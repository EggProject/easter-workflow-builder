import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentsFieldEditor } from './AgentsFieldEditor.tsx';

function typeInto(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function findButtonByText(scope: ParentNode, text: string): HTMLButtonElement {
  const button = [...scope.querySelectorAll('button')].find((candidate) => candidate.textContent === text);
  if (button === undefined) {
    throw new Error(`a teszt nem talált "${text}" feliratú gombot`);
  }
  return button;
}

describe('AgentsFieldEditor', () => {
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

  it('üres rekordra "Nincs felvett agent" szöveget mutat', () => {
    act(() => {
      root.render(<AgentsFieldEditor value={{}} onChange={vi.fn()} />);
    });
    expect(container.textContent).toContain('Nincs felvett agent');
  });

  it('minden kulcsot felsorol, kezdetben összecsukva', () => {
    act(() => {
      root.render(<AgentsFieldEditor value={{ kutato: { description: '', prompt: '' } }} onChange={vi.fn()} />);
    });
    expect(container.querySelector('legend')?.textContent).toBe('kutato');
    expect(container.querySelector('[aria-expanded="false"]')).not.toBeNull();
    expect(container.querySelector('.agent-definition-entry-fields')).toBeNull();
  });

  it('a kibontás gombra megjelenik a bejegyzés szerkesztő űrlapja, majd az összecsukás elrejti', () => {
    act(() => {
      root.render(<AgentsFieldEditor value={{ kutato: { description: '', prompt: '' } }} onChange={vi.fn()} />);
    });
    act(() => {
      findButtonByText(container, 'Kibontás').click();
    });
    expect(container.querySelector('.agent-definition-entry-fields')).not.toBeNull();

    act(() => {
      findButtonByText(container, 'Összecsukás').click();
    });
    expect(container.querySelector('.agent-definition-entry-fields')).toBeNull();
  });

  it('a bejegyzés szerkesztése ráolvasztva frissíti a teljes agents rekordot', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <AgentsFieldEditor
          value={{ kutato: { description: '', prompt: '' }, masik: { description: 'x', prompt: 'y' } }}
          onChange={onChange}
        />,
      );
    });
    act(() => {
      findButtonByText(container, 'Kibontás').click();
    });
    const promptTextarea = [...container.querySelectorAll('textarea')][1];
    if (promptTextarea === undefined) {
      throw new Error('a teszt nem találta a második textarea-t');
    }
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    act(() => {
      descriptor?.set?.call(promptTextarea, 'új prompt');
      promptTextarea.dispatchEvent(new Event('input', { bubbles: true }));
      promptTextarea.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(onChange).toHaveBeenCalledWith({
      kutato: { description: '', prompt: 'új prompt' },
      masik: { description: 'x', prompt: 'y' },
    });
  });

  it('a törlés gomb eltávolítja a kulcsot, a többi megmarad', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <AgentsFieldEditor value={{ kutato: { description: '', prompt: '' }, masik: {} }} onChange={onChange} />,
      );
    });
    act(() => {
      findButtonByText(container, 'Törlés').click();
    });
    expect(onChange).toHaveBeenCalledWith({ masik: {} });
  });

  it('az új agent hozzáadása gomb üres névre le van tiltva, kitöltésre felveszi az alapértéket', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(<AgentsFieldEditor value={{}} onChange={onChange} />);
    });
    const agentAddButton = findButtonByText(container, 'Agent hozzáadása');
    expect(agentAddButton.disabled).toBe(true);

    const nameInput = container.querySelector<HTMLInputElement>('input[aria-label], input');
    if (nameInput === null) {
      throw new Error('a teszt nem találta a név mezőt');
    }
    act(() => {
      typeInto(nameInput, 'uj-agent');
    });
    expect(agentAddButton.disabled).toBe(false);
    act(() => {
      agentAddButton.click();
    });
    expect(onChange).toHaveBeenCalledWith({ 'uj-agent': { description: '', prompt: '' } });
  });

  it('meglévő névre a hozzáadás gomb letiltva marad', () => {
    act(() => {
      root.render(<AgentsFieldEditor value={{ kutato: {} }} onChange={vi.fn()} />);
    });
    const nameInput = [...container.querySelectorAll('input')].at(-1);
    if (nameInput === undefined) {
      throw new Error('a teszt nem találta a név mezőt');
    }
    act(() => {
      typeInto(nameInput, 'kutato');
    });
    expect(findButtonByText(container, 'Agent hozzáadása').disabled).toBe(true);
  });

  it('az átnevezés gomb új, egyedi névre lecseréli a kulcsot, a sorrend és a tartalom megmarad', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <AgentsFieldEditor value={{ kutato: { description: 'x', prompt: 'y' }, masik: {} }} onChange={onChange} />,
      );
    });
    const renameInput = container.querySelector<HTMLInputElement>(`input[aria-label='"kutato" agent új neve']`);
    if (renameInput === null) {
      throw new Error('a teszt nem találta az átnevezés mezőt');
    }
    act(() => {
      typeInto(renameInput, 'atnevezve');
    });
    act(() => {
      findButtonByText(container, 'Átnevezés').click();
    });
    expect(onChange).toHaveBeenCalledWith({ atnevezve: { description: 'x', prompt: 'y' }, masik: {} });
  });

  it('az átnevezés gomb változatlan névre letiltva marad', () => {
    act(() => {
      root.render(<AgentsFieldEditor value={{ kutato: {} }} onChange={vi.fn()} />);
    });
    expect(findButtonByText(container, 'Átnevezés').disabled).toBe(true);
  });

  it('az átnevezés gomb ütköző (már létező) névre letiltva marad', () => {
    act(() => {
      root.render(<AgentsFieldEditor value={{ kutato: {}, masik: {} }} onChange={vi.fn()} />);
    });
    const renameInput = container.querySelector<HTMLInputElement>(`input[aria-label='"kutato" agent új neve']`);
    if (renameInput === null) {
      throw new Error('a teszt nem találta az átnevezés mezőt');
    }
    act(() => {
      typeInto(renameInput, 'masik');
    });
    expect(findButtonByText(container, 'Átnevezés').disabled).toBe(true);
  });

  it('az átnevezés gomb csak szóközből álló névre is letiltva marad', () => {
    act(() => {
      root.render(<AgentsFieldEditor value={{ kutato: {} }} onChange={vi.fn()} />);
    });
    const renameInput = container.querySelector<HTMLInputElement>(`input[aria-label='"kutato" agent új neve']`);
    if (renameInput === null) {
      throw new Error('a teszt nem találta az átnevezés mezőt');
    }
    act(() => {
      typeInto(renameInput, ' '.repeat(3));
    });
    expect(findButtonByText(container, 'Átnevezés').disabled).toBe(true);
  });
});
