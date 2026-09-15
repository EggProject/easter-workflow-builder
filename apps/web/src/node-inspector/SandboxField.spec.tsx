import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SandboxField } from './SandboxField.tsx';

function typeInto(textarea: HTMLTextAreaElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
  descriptor?.set?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  textarea.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('SandboxField', () => {
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

  it('`null` értékre a jelölőnégyzet kikapcsolva, a JSON szerkesztő rejtve', () => {
    act(() => {
      // eslint-disable-next-line unicorn/no-null -- a teszt a "nincs felülírás" állapotot vizsgálja.
      root.render(<SandboxField value={null} onChange={vi.fn()} />);
    });
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (checkbox === null) {
      throw new Error('a teszt nem találta a jelölőnégyzetet');
    }
    expect(checkbox.checked).toBe(false);
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('a jelölőnégyzet bekapcsolására egy érvényes alapértelmezett SandboxConfig-ot ad', () => {
    const onChange = vi.fn();
    act(() => {
      // eslint-disable-next-line unicorn/no-null -- lásd fent.
      root.render(<SandboxField value={null} onChange={onChange} />);
    });
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (checkbox === null) {
      throw new Error('a teszt nem találta a jelölőnégyzetet');
    }
    act(() => {
      checkbox.click();
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
  });

  it('a jelölőnégyzet kikapcsolására `null`-t ad', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <SandboxField
          value={{
            enabled: true,
            failIfUnavailable: false,
            autoAllowBashIfSandboxed: false,
            excludedCommands: [],
            enableWeakerNestedSandbox: false,
          }}
          onChange={onChange}
        />,
      );
    });
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    if (checkbox === null) {
      throw new Error('a teszt nem találta a jelölőnégyzetet');
    }
    expect(checkbox.checked).toBe(true);
    act(() => {
      checkbox.click();
    });
    // eslint-disable-next-line unicorn/no-null -- a teszt a "felülírás visszavonása" állapotot vizsgálja.
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('bekapcsolt állapotban a JSON szerkesztő megjelenik, és érvényes szerkesztésre frissíti a mezőt', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <SandboxField
          value={{
            enabled: true,
            failIfUnavailable: false,
            autoAllowBashIfSandboxed: false,
            excludedCommands: [],
            enableWeakerNestedSandbox: false,
          }}
          onChange={onChange}
        />,
      );
    });
    const textarea = container.querySelector('textarea');
    if (textarea === null) {
      throw new Error('a teszt nem találta a JSON textarea-t');
    }
    act(() => {
      typeInto(
        textarea,
        JSON.stringify({
          enabled: false,
          failIfUnavailable: true,
          autoAllowBashIfSandboxed: false,
          excludedCommands: ['rm'],
          enableWeakerNestedSandbox: false,
        }),
      );
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: false, excludedCommands: ['rm'] }));
  });

  it('egy `SandboxConfig` sémának meg nem felelő JSON szerkesztésre nem hívja az onChange-et', () => {
    const onChange = vi.fn();
    act(() => {
      root.render(
        <SandboxField
          value={{
            enabled: true,
            failIfUnavailable: false,
            autoAllowBashIfSandboxed: false,
            excludedCommands: [],
            enableWeakerNestedSandbox: false,
          }}
          onChange={onChange}
        />,
      );
    });
    const textarea = container.querySelector('textarea');
    if (textarea === null) {
      throw new Error('a teszt nem találta a JSON textarea-t');
    }
    act(() => {
      typeInto(textarea, JSON.stringify({ nemMegfelelo: true }));
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
