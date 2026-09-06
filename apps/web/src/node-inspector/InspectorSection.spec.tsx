import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InspectorSection } from './InspectorSection.tsx';

describe('InspectorSection', () => {
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

  it('a csoport role="group" szerepet kap, a címére mutató aria-labelledby kötéssel', () => {
    act(() => {
      root.render(
        <InspectorSection title="prompt és provider">
          <input aria-label="mező" />
        </InspectorSection>,
      );
    });
    const group = container.querySelector('[role="group"]');
    expect(group).not.toBeNull();
    const titleId = group?.getAttribute('aria-labelledby');
    expect(titleId).toBeTruthy();
    const title = titleId === null || titleId === undefined ? undefined : document.querySelector(`#${titleId}`);
    expect(title?.textContent).toBe('prompt és provider');
  });

  it('a cím h3 elem, a panel h2 fejléce alatti szinten', () => {
    act(() => {
      root.render(<InspectorSection title="futási korlátok">{undefined}</InspectorSection>);
    });
    const title = container.querySelector('.inspector-section__title');
    expect(title?.tagName).toBe('H3');
  });

  it('a gyerekeit a mezőket tartó dobozban rendereli', () => {
    act(() => {
      root.render(
        <InspectorSection title="eszközök">
          <span data-testid="gyerek">tartalom</span>
        </InspectorSection>,
      );
    });
    expect(container.querySelector('.inspector-section__fields')?.textContent).toBe('tartalom');
  });

  it('két szakasz két KÜLÖNBÖZŐ azonosítót kap, tehát a nevük nem keveredik', () => {
    act(() => {
      root.render(
        <>
          <InspectorSection title="első">{undefined}</InspectorSection>
          <InspectorSection title="második">{undefined}</InspectorSection>
        </>,
      );
    });
    const labelledBy = [...container.querySelectorAll('[role="group"]')].map((group) =>
      group.getAttribute('aria-labelledby'),
    );
    expect(labelledBy).toHaveLength(2);
    expect(labelledBy[0]).not.toBe(labelledBy[1]);
  });
});
