import { describe, expect, it } from 'vitest';
import { readOptionElement } from './read-option-element.ts';

function buildPanel(optionCount: number): HTMLElement {
  const panel = document.createElement('div');
  for (let index = 0; index < optionCount; index += 1) {
    const option = document.createElement('div');
    option.setAttribute('role', 'option');
    option.textContent = `opció ${String(index)}`;
    panel.append(option);
  }
  return panel;
}

describe('readOptionElement', () => {
  it('a kért sorszámú opció elemét adja vissza', () => {
    const panel = buildPanel(3);

    expect(readOptionElement(panel, 1).textContent).toBe('opció 1');
  });

  it('hibát dob, ha a kért sorszámon nincs opció', () => {
    const panel = buildPanel(2);

    expect(() => readOptionElement(panel, 5)).toThrow('a select opció nincs csatolva a DOM-hoz');
  });
});
