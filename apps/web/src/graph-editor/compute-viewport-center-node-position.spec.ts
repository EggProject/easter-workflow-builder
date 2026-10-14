import { describe, expect, it } from 'vitest';
import { GRAPH_NODE_CARD_HEIGHT, GRAPH_NODE_CARD_WIDTH } from '../graph-node-catalog/graph-node-catalog.ts';
import { computeViewportCenterNodePosition } from './compute-viewport-center-node-position.ts';

const HALF_WIDTH = GRAPH_NODE_CARD_WIDTH / 2;
const HALF_HEIGHT = GRAPH_NODE_CARD_HEIGHT / 2;

describe('computeViewportCenterNodePosition', () => {
  it('eltolás és nagyítás nélkül a vászon közepe a kártya közepe', () => {
    expect(computeViewportCenterNodePosition({ width: 1000, height: 600, transform: [0, 0, 1] })).toEqual({
      x: 500 - HALF_WIDTH,
      y: 300 - HALF_HEIGHT,
    });
  });

  it('az eltolást a középpontból levonja: a vászon jobbra tolva a flow középpont balra kerül', () => {
    expect(computeViewportCenterNodePosition({ width: 1000, height: 600, transform: [200, -100, 1] })).toEqual({
      x: 300 - HALF_WIDTH,
      y: 400 - HALF_HEIGHT,
    });
  });

  it('a nagyítással osztja a középpontot, de a kártya méret felét flow koordinátában vonja le', () => {
    expect(computeViewportCenterNodePosition({ width: 1000, height: 600, transform: [100, 50, 2] })).toEqual({
      x: 200 - HALF_WIDTH,
      y: 125 - HALF_HEIGHT,
    });
  });

  it('kicsinyítésnél a flow középpont távolabb kerül az origótól', () => {
    expect(computeViewportCenterNodePosition({ width: 800, height: 400, transform: [0, 0, 0.5] })).toEqual({
      x: 800 - HALF_WIDTH,
      y: 400 - HALF_HEIGHT,
    });
  });

  it('a kártya közepe visszaváltva a képernyő koordinátába a vászon közepére esik', () => {
    const geometry = { width: 1013, height: 587, transform: [-120, 75, 1.5] } as const;
    const [translateX, translateY, zoom] = geometry.transform;
    const position = computeViewportCenterNodePosition(geometry);
    const screenCenterX = (position.x + HALF_WIDTH) * zoom + translateX;
    const screenCenterY = (position.y + HALF_HEIGHT) * zoom + translateY;
    expect(screenCenterX).toBeCloseTo(geometry.width / 2, 9);
    expect(screenCenterY).toBeCloseTo(geometry.height / 2, 9);
  });
});
