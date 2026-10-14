import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { BranchHighlightToggle } from './BranchHighlightToggle.tsx';
import type { BranchHighlightMode } from './branch-highlight-mode.ts';

describe('BranchHighlightToggle', () => {
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

  function renderToggle(
    mode: BranchHighlightMode,
    onToggle: () => void = () => {
      // a legtöbb teszt nem figyeli a váltást
    },
  ): HTMLButtonElement {
    act(() => {
      root.render(<BranchHighlightToggle mode={mode} onToggle={onToggle} />);
    });
    const button = container.querySelector('button');
    if (button === null) {
      throw new Error('a teszt nem talált kapcsoló gombot');
    }
    return button;
  }

  it('React Flow vezérlő gomb, azonos aria-label és title felirattal', () => {
    const button = renderToggle('latest');
    expect(button.classList.contains('react-flow__controls-button')).toBe(true);
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('Minden bejárt ág kiemelése');
    expect(button.getAttribute('title')).toBe('Minden bejárt ág kiemelése');
  });

  it('a "csak a legutóbbi" módban nincs lenyomva', () => {
    expect(renderToggle('latest').getAttribute('aria-pressed')).toBe('false');
  });

  it('a "minden eddig bejárt ág" módban le van nyomva', () => {
    expect(renderToggle('all').getAttribute('aria-pressed')).toBe('true');
  });

  it('az ikon a hozzáférhetőségi fából kizárt, vonalas SVG', () => {
    const icon = renderToggle('latest').querySelector('svg');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(icon?.getAttribute('viewBox')).toBe('0 0 24 24');
    expect(icon?.getAttribute('fill')).toBe('none');
    expect(icon?.getAttribute('stroke')).toBe('currentColor');
  });

  it('a kattintás a váltó callbacket hívja', () => {
    let toggleCount = 0;
    const button = renderToggle('latest', () => {
      toggleCount += 1;
    });
    act(() => {
      button.click();
    });
    expect(toggleCount).toBe(1);
  });
});

describe('a kapcsoló lenyomott állapota és a run-graph.css', () => {
  const directory = path.dirname(fileURLToPath(import.meta.url));
  const stylesheet = readFileSync(path.join(directory, 'run-graph.css'), 'utf8');
  const rulePattern = /^\.run-graph-canvas[^{]*\[aria-pressed='true'\][^{]*\{([^}]*)\}/m;

  it("a design system toggle [aria-pressed='true'] szabályának háttér, keret és szín tokenjeit követi", () => {
    const declarations = rulePattern.exec(stylesheet)?.[1] ?? '';
    expect(declarations).toMatch(/background:\s*var\(--ep-accent-bg\);/);
    expect(declarations).toMatch(/box-shadow:\s*inset 0 0 0 1px var\(--ep-accent\);/);
    expect(declarations).toMatch(/color:\s*var\(--ep-accent-fg, var\(--ep-yolk-700\)\);/);
  });
});
