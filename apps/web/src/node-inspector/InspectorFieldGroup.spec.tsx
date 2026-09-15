import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InspectorFieldGroup } from './InspectorFieldGroup.tsx';

describe('InspectorFieldGroup', () => {
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
        <InspectorFieldGroup title="Bekapcsolt motor hookok">
          <input aria-label="mező" />
        </InspectorFieldGroup>,
      );
    });
    const group = container.querySelector('[role="group"]');
    expect(group).not.toBeNull();
    const titleId = group?.getAttribute('aria-labelledby');
    expect(titleId).toBeTruthy();
    const title = titleId === null || titleId === undefined ? undefined : document.querySelector(`#${titleId}`);
    expect(title?.textContent).toBe('Bekapcsolt motor hookok');
  });

  it('NINCS kártya alakú doboz: a design system .field__label címkéje és egy tiszta elrendezés csoport', () => {
    act(() => {
      root.render(<InspectorFieldGroup title="eszközök">{undefined}</InspectorFieldGroup>);
    });
    expect(container.querySelector('.inspector-section')).toBeNull();
    expect(container.querySelector('.card')).toBeNull();
    expect(container.querySelector('[role="group"]')?.className).toBe('node-inspector__group');
    expect(container.querySelector('.field__label')?.tagName).toBe('SPAN');
  });

  it('a gyerekeit közvetlenül a csoportba rendereli, közbeiktatott doboz nélkül', () => {
    act(() => {
      root.render(
        <InspectorFieldGroup title="eszközök">
          <span>tartalom</span>
        </InspectorFieldGroup>,
      );
    });
    const group = container.querySelector('[role="group"]');
    expect(group?.lastElementChild?.textContent).toBe('tartalom');
  });

  it('két csoport két KÜLÖNBÖZŐ azonosítót kap, tehát a nevük nem keveredik', () => {
    act(() => {
      root.render(
        <>
          <InspectorFieldGroup title="első">{undefined}</InspectorFieldGroup>
          <InspectorFieldGroup title="második">{undefined}</InspectorFieldGroup>
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
