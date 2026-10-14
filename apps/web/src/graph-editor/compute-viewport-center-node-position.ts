import { GRAPH_NODE_CARD_HEIGHT, GRAPH_NODE_CARD_WIDTH } from '../graph-node-catalog/graph-node-catalog.ts';

/**
 * A React Flow store három mezője, amiből a látható vászon középpontja
 * számítható (SPEC-008 5.8, M-98, M-99): a vászon mérete pixelben és a
 * `transform` (`[x, y, zoom]`, az eltolás pixelben és a nagyítás).
 */
export interface ViewportGeometry {
  readonly width: number;
  readonly height: number;
  readonly transform: readonly [x: number, y: number, zoom: number];
}

/**
 * Az az új kártya bal felső sarka (flow koordinátában), amelynek a közepe a
 * látható vászon középpontja (SPEC-008 5.8, user döntés 7.). A középpont a
 * könyvtár saját átváltása szerint `((width / 2 - x) / zoom, (height / 2 - y) /
 * zoom)`, a bal felső sarok ettől a kártya méret konstans felével balra és
 * feljebb van. Tiszta függvény: mért csomópont geometriát és DOM-ot nem olvas
 * (SPEC-008 12.2).
 */
export function computeViewportCenterNodePosition(geometry: ViewportGeometry): { x: number; y: number } {
  const { width, height, transform } = geometry;
  const [translateX, translateY, zoom] = transform;
  return {
    x: (width / 2 - translateX) / zoom - GRAPH_NODE_CARD_WIDTH / 2,
    y: (height / 2 - translateY) / zoom - GRAPH_NODE_CARD_HEIGHT / 2,
  };
}
