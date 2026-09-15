import { ReactFlowProvider } from '@xyflow/react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FitViewOnAutoLayout } from './FitViewOnAutoLayout.tsx';

/**
 * Amit ez a fájl NEM tesztel, és miért. A `fitView()` tényleges hatása (a
 * nézet nagyítása és eltolása) MÉRT GEOMETRIÁTÓL függ: a React Flow a
 * csomópontok kimért méretéből számolja, amit happy-dom alatt nem kap meg
 * (`docs/research/2026-09-05-grafszerkeszto-es-transcript.md` 1. szekció:
 * a `ResizeObserver` stub sosem hívja meg a callback-et). A hívás magát sem
 * lehet kémlelni, mert a `useReactFlow()` visszatérési értéke a könyvtár
 * saját, teljes `ReactFlowInstance` típusa, amit a projekt `as` tilalma
 * mellett nem lehet részleges mockkal helyettesíteni. A TÉNYLEGES
 * viselkedést ezért valós böngészőben az `e2e/graph-auto-layout.spec.ts`
 * "a nézet újra a teljes gráfra illeszkedik" tesztje őrzi.
 */
describe('FitViewOnAutoLayout', () => {
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

  function renderWithRevision(revision: number): void {
    act(() => {
      root.render(
        <ReactFlowProvider>
          <FitViewOnAutoLayout revision={revision} />
        </ReactFlowProvider>,
      );
    });
  }

  it('nem rajzol semmit, és a revision változása sem dob hibát', () => {
    renderWithRevision(0);
    expect(container.textContent).toBe('');
    renderWithRevision(1);
    expect(container.textContent).toBe('');
  });
});
