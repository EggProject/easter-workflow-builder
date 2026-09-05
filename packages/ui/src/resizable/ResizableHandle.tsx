import { useContext, type KeyboardEvent, type PointerEvent, type ReactElement } from 'react';
import { ResizableContext } from './resizable-context.ts';

export interface ResizableHandleProperties {
  /**
   * A bal/felső oldali panel sorszáma, amit ez az elválasztó a következővel
   * párban mozgat.
   */
  readonly beforeIndex: number;
  readonly 'aria-label'?: string;
}

const ARROW_STEP_PERCENT = 5;
const SHIFT_ARROW_STEP_PERCENT = 10;
const HOME_DELTA_PERCENT = -100;
const END_DELTA_PERCENT = 100;

/**
 * Egy `Resizable` elválasztója, `role="separator"` szemantikával. A forrás
 * `Resizable.jsx` billentyűzet kezelését követi (nyilak az elrendezés
 * tengelyén, `Shift` dupla lépésköz, `Home`/`End` a szélső értékre), plusz
 * az ÚJ `Enter` (lásd `Resizable.tsx` fejléc dokumentációja). A hat ARIA
 * attribútum: `aria-orientation`, `aria-label`, `aria-controls`,
 * `aria-valuemin`, `aria-valuemax`, `aria-valuenow`.
 */
export function ResizableHandle(properties: Readonly<ResizableHandleProperties>): ReactElement {
  const { beforeIndex, 'aria-label': ariaLabelOverride } = properties;
  const { sizes, direction, activeHandleIndex, panelDomId, beginDrag, resizeByDelta, toggleCollapse } =
    useContext(ResizableContext);
  const isVertical = direction === 'vertical';
  const sizeBefore = sizes[beforeIndex];

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    beginDrag(beforeIndex, isVertical ? event.clientY : event.clientX);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step = event.shiftKey ? SHIFT_ARROW_STEP_PERCENT : ARROW_STEP_PERCENT;
    switch (event.key) {
      case 'ArrowLeft': {
        if (isVertical) {
          return;
        }
        event.preventDefault();
        resizeByDelta(beforeIndex, -step);
        return;
      }
      case 'ArrowRight': {
        if (isVertical) {
          return;
        }
        event.preventDefault();
        resizeByDelta(beforeIndex, step);
        return;
      }
      case 'ArrowUp': {
        if (!isVertical) {
          return;
        }
        event.preventDefault();
        resizeByDelta(beforeIndex, -step);
        return;
      }
      case 'ArrowDown': {
        if (!isVertical) {
          return;
        }
        event.preventDefault();
        resizeByDelta(beforeIndex, step);
        return;
      }
      case 'Home': {
        event.preventDefault();
        resizeByDelta(beforeIndex, HOME_DELTA_PERCENT);
        return;
      }
      case 'End': {
        event.preventDefault();
        resizeByDelta(beforeIndex, END_DELTA_PERCENT);
        return;
      }
      case 'Enter': {
        event.preventDefault();
        toggleCollapse(beforeIndex);
        return;
      }
      default: {
        return;
      }
    }
  };

  return (
    <div
      className={`resizable-handle${activeHandleIndex === beforeIndex ? ' is-dragging' : ''}`}
      role="separator"
      aria-orientation={isVertical ? 'horizontal' : 'vertical'}
      aria-label={ariaLabelOverride ?? `Resize panels ${String(beforeIndex + 1)} and ${String(beforeIndex + 2)}`}
      aria-controls={`${panelDomId(beforeIndex)} ${panelDomId(beforeIndex + 1)}`}
      aria-valuemin={5}
      aria-valuemax={95}
      aria-valuenow={sizeBefore === undefined ? undefined : Math.round(sizeBefore)}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    />
  );
}
